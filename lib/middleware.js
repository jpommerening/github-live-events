var events = require( 'events' );
var SSE = require( './sse' ).SSE;

var fanout = new events.EventEmitter();

module.exports = {
   api: handleApi,
   sse: handleSSE,
   webhook: handleWebHook
};

function handleApi( req, res, next ) {
   next();
}

function handleSSE( req, res, next ) {
   var sse = new SSE( req, res );

   function pipe() {
      req.log.info( 'Pushing event to client' );
      sse.emit.apply( sse, [ 'event' ].concat( arguments ) );
   }

   fanout.addListener( 'event', pipe );
   res.on( 'close', function() {
      fanout.removeListener( 'event', pipe );
   } );

   next();
}

function handleWebHook( req, res, next ) {
   req.log.info( 'Received webhook data', req.body );
   fanout.emit( 'event', req.body );
   res.send( { msg: 'Ok, thanks' } );

   next();
}

