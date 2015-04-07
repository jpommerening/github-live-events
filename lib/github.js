var assert = require( 'assert' );
var crypto = require( 'crypto' );
var util = require( 'util' );
var restify = require( 'restify' );

module.exports = {
   bodyParser: bodyParser
};

function bodyParser( options ) {
   var parseBody = restify.bodyParser( options );

   assert.ok( util.isArray( parseBody ) );
   assert.equal( parseBody.length, 2 );

   // the restify bodyParser consists of a "bodyReader" (first element)
   // and the parser (second element)

   if( options.secretToken ) {
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
         req.hmac = crypto.createHmac( 'sha1', new Buffer( options.secretToken ) );
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
            return; // don't call next
         }
      }
      next();
   }
}
