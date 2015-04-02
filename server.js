var restify = require( 'restify' );
var debug = require( 'debug' )( 'http' );
var fs = require( 'fs' );

var package = require( './package.json' );
var middleware = require( './lib/middleware' );

var server = restify.createServer( {
   name: package.name,
   version: package.version,
   acceptable: [ 'text/event-stream' ]
} );

//server.use( restify.acceptParser( server.acceptable ) );
server.use( restify.queryParser() );
server.use( restify.bodyParser() );

server.pre( function( req, res, next ) {
   req.log.info( '%s %s', req.method, req.url );
   next();
} );

server.get( '/console', function( req, res, next ) {
   res.setHeader( 'Content-Type', 'text/html' );
   fs.createReadStream( 'static/index.html' ).pipe( res );
} );
server.get( '/api', middleware.api );
server.get( '/sse', middleware.sse );
server.post( '/webhook', middleware.webhook );

/*
server.use( restify.conditionalRequest() );
server.use( restify.gzipResponse() );
server.use( restify.CORS( {
   origins: [ '*' ]
} ) );
*/

server.listen( process.env.PORT || 5000, function() {
   server.log.info( '%s listening %s', server.name, server.url );
} );

server.log.level('TRACE');
