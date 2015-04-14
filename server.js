var restify = require( 'restify' );
var fs = require( 'fs' );

var config = require( './config' );
var github = require( './lib/github' );

var server = restify.createServer( {
   name: config.name + ' ' + config.version
} );

var io = require( 'socket.io' ).listen( server.server );

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

server.get( '/api', function( req, res, next ) {
} );

server.post( '/webhook', function( req, res, next ) {
   res.send( { msg: 'Got it, thanks!' } );
   next();

   var name = req.header( 'X-GitHub-Event' );
   var event = github.webhookEvent( name, req.body );
   var emitters = [ io ];

   if( event.actor ) {
      emitters.push( io.to( '/users/' + event.actor.login + '/events' ) );
   }
   if( event.org ) {
      emitters.push( io.to( '/orgs/' + event.org.login + '/events' ) );
   }
   if( event.repo ) {
      emitters.push( io.to( '/repos/' + event.repo.owner.login + '/' + event.repo.name + '/events' ) );
   }

   emitters.forEach( function( emitter ) {
      emitter.emit( '*', event );
      emitter.emit( name, event );
   } );
} );

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
