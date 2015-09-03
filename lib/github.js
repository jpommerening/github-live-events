var assert = require( 'assert' );
var crypto = require( 'crypto' );
var querystring = require( 'querystring' );
var url = require( 'url' );
var util = require( 'util' );
var lru = require( 'lru-cache' );
var restify = require( 'restify' );

module.exports = {
   bodyParser: bodyParser,
   authHandler: authHandler,
   webhookEvent: webhookEvent
};

function bodyParser( options ) {
   var parseBody = restify.bodyParser( options );

   assert.ok( util.isArray( parseBody ) );
   assert.equal( parseBody.length, 2 );

   // the restify bodyParser consists of a "bodyReader" (first element)
   // and the parser (second element)

   if( options.webhookSecret ) {
      return [
         createHmac,
         parseBody[0],
         validateHmac,
         parseBody[1]
      ];
   } else {
      return parseBody;
   }

   function createHmac( req, res, next ) {
      var signatureHeader = req.header( 'X-Hub-Signature' );

      if( signatureHeader ) {
         req.hmac = crypto.createHmac( 'sha1', new Buffer( options.webhookSecret ) );
         req.on( 'data', req.hmac.update.bind( req.hmac ) );
         req.pause();
      }
      next();
   }

   function validateHmac( req, res, next ) {
      var signatureHeader = req.header( 'X-Hub-Signature' );

      if( signatureHeader ) {
         var signature = 'sha1=' + req.hmac.digest( 'hex' );

         if( signature === signatureHeader ) {
            req.log.debug( 'X-Hub-Signature match (%s)', signature );
         } else {
            req.log.debug( 'X-Hub-Signature mismatch (%s != %s), dropping request',
                           signature, signatureHeader );
            res.send( 500, 'X-Hub-Signature mismatch' );
         }
      }
      next();
   }
}

function authHandler( options ) {
   var states = lru( { max: 100 } );
   var client = restify.createJsonClient( { url: options.githubUrl } );

   return [
      initiateOAuth,
      getAccessToken
   ];

   function initiateOAuth( req, res, next ) {
      if( req.params.code ) {
         return next();
      }

      crypto.randomBytes( 256, function( err, buffer ) {
         if( err ) {
            return next( err );
         }

         var state = crypto.createHash( 'sha1' ).update( buffer ).digest( 'hex' );
         var redirect = url.parse( client.url.href );

         redirect.pathname = '/login/oauth/authorize';
         redirect.search = querystring.stringify( {
            client_id: options.clientId,
            scope: req.params.scope || options.scope,
            state: state
         } );

         res.header( 'Location', url.format( redirect ) );
         res.send( 302 );
         states.set( state, req.params );

         next();
      } );
   }

   function getAccessToken( req, res, next ) {
      var data = req.params;
      var code = data.code;
      var state = data.state;

      if( !code || !state || !states.has( state ) ) {
         return next();
      }

      var params = states.get( state );
      var redirectUri = params.redirect_uri;
      var responseType = params.response_type || 'code';

      states.del( state );

      function sendResponse( data ) {
         var redirect;
         var property = (responseType === 'token') ? 'hash' : 'search';
         var value;

         if( redirectUri ) {
            redirect = url.parse( redirectUri );
            value = redirect[ property ] || '';
            value += value.indexOf( '?' ) >= 0 ? '&' : '?';
            redirect[ property ] = value + querystring.stringify( data );
            res.header( 'Location', url.format( redirect ) );
            res.send( 302 );
         } else {
            res.send( 200, data );
         }
      }

      if( responseType === 'token' ) {

         client.post( '/login/oauth/access_token', {
            client_id: options.clientId,
            client_secret: options.clientSecret,
            code: code
         }, function( err, req_, res_, data ) {
            if( err ) {
               return next( err );
            }

            sendResponse( data );
            next();
         } );

      } else {

         sendResponse( data );
         next();

      }
   }
}

/**
 * Process events to look like they were obtained from the API instead of the webhook
 */
function webhookEvent( name, body ) {
   var payload = Object.keys( body ).reduce( function( payload, key ) {
      if( key !== 'sender' && key !== 'repository' && key !== 'organization' ) {
         payload[ key ] = body[ key ];
      }
      return payload;
   }, {} );
   var event = {
      actor: body.sender,
      created_at: null,
      id: null,
      payload: payload,
      public: true,
      repo: body.repository,
      org: body.organization,
      type: name.replace( /(^|_)([a-z])/g, function( _1, _2, letter ) {
         return letter.toUpperCase();
      } ) + 'Event'
   };

   if( name === 'issues' ) {
      switch( payload.action ) {
         case 'created':
            event.created_at = payload.issue.created_at;
            break;
         case 'closed':
            event.created_at = payload.issue.closed_at;
            break;
         default:
            event.created_at = payload.issue.updated_at;
            break;
      }
   } else if( name === 'issue_comment' ) {
      switch( payload.action ) {
         case 'created':
            event.created_at = payload.comment.created_at;
            break;
      }
   } else if( name === 'page_build' ) {
      event.created_at = payload.build.created_at;
   } else if( name === 'release' ) {
      switch( payload.action ) {
         case 'pulished':
            event.created_at = payload.release.published_at;
            break;
      }
   } else if( name === 'repository' ) {
      switch( payload.action ) {
         case 'created':
            event.created_at = payload.repository.created_at;
            break;
      }
   } else {
      event.created_at = new Date().toISOString();
   }

   return event;
}
