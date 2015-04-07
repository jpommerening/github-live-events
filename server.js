var restify = require( 'restify' );
var fs = require( 'fs' );
var crypto = require( 'crypto' );

var package = require( './package.json' );
var middleware = require( './lib/middleware' );
var github = require( './lib/github' );

var server = restify.createServer( {
   name: package.name,
   version: package.version,
   acceptable: [ 'text/event-stream' ]
} );

var config = {
   port:        process.env.PORT         || process.env.npm_package_config_port         || package.config.port,
   hostname:    process.env.HOSTNAME     || process.env.npm_package_config_hostname     || package.config.hostname,
   logLevel:    process.env.LOG_LEVEL    || process.env.npm_package_config_log_level    || package.config.log_level,
   secretToken: process.env.SECRET_TOKEN || process.env.npm_package_config_secret_token
};

server.pre( function( req, res, next ) {
   req.log.info( '%s %s', req.method, req.url );
   next();
} );

server.use( restify.queryParser() );
server.use( github.bodyParser( { secretToken: config.secretToken } ) );

server.get( '/', function( req, res, next ) {
   res.setHeader( 'Content-Type', 'text/html' );
   fs.createReadStream( 'static/index.html' ).pipe( res );
} );
server.get( '/api', middleware.api );
server.get( '/sse', middleware.sse );
server.post( '/webhook', middleware.webhook );

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
