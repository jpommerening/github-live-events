var assert = require( 'assert' );
var crypto = require( 'crypto' );
var querystring = require( 'querystring' );
var url = require( 'url' );
var util = require( 'util' );
var lru = require( 'lru-cache' );
var restify = require( 'restify' );

module.exports = {
   bodyParser: bodyParser,
   authHandler: authHandler
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
            scope: options.scope,
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
      var redirectUrl = params.redirect_url;
      var responseType = params.response_type;

      states.del( state );

      function sendResponse( data ) {
         var redirect;
         var property = (responseType === 'token') ? 'hash' : 'search';

         if( redirectUrl ) {
            redirect = url.parse( params.redirect_url );
            redirect[ property ] = querystring.stringify( data );
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
