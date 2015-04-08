var restify = require( 'restify' );
var fs = require( 'fs' );
var crypto = require( 'crypto' );

var config = require( './lib/config' );
var middleware = require( './lib/middleware' );
var github = require( './lib/github' );

var server = restify.createServer( {
   name: config.name,
   version: config.version,
   acceptable: [ 'text/event-stream' ]
} );

server.pre( function( req, res, next ) {
   req.log.info( '%s %s', req.method, req.url );
   next();
} );

server.use( restify.queryParser() );
server.use( github.bodyParser( {
   webhookSecret: config.webhookSecret
} ) );

server.get( '/auth', github.authHandler( {
   clientId: config.clientId,
   clientSecret: config.clientSecret,
   githubUrl: config.githubUrl
} ) );
server.get( '/api', middleware.api );
server.get( '/sse', middleware.sse );
server.post( '/webhook', middleware.webhook );

server.get( '/', function( req, res, next ) {
   res.setHeader( 'Content-Type', 'text/html' );
   fs.createReadStream( 'static/index.html' ).pipe( res );
} );

/*
server.use( restify.conditionalRequest() );
*/

server.use( restify.gzipResponse() );
server.use( restify.CORS( {
   origins: [ '*' ]
} ) );

server.listen( config.port, config.hostname, function() {
   server.log.info( '%s listening at %s', server.name, server.url );
} );

server.log.level( config.logLevel );
