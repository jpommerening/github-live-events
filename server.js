var restify = require( 'restify' );
var fs = require( 'fs' );
var crypto = require( 'crypto' );

var middleware = require( './lib/middleware' );
var github = require( './lib/github' );

var server = restify.createServer( {
   name: package.name,
   version: package.version,
   acceptable: [ 'text/event-stream' ]
} );

server.pre( function( req, res, next ) {
   req.log.info( '%s %s', req.method, req.url );
   next();
} );

server.use( restify.queryParser() );
server.use( github.bodyParser( { secretToken: process.env.SECRET_TOKEN } ) );

server.get( '/', function( req, res, next ) {
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
