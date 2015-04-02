var EventEmitter = require( 'events' ).EventEmitter;
var inherits = require( 'util' ).inherits;

function SSE( req, res ) {
   this.req = req;
   this.res = res;

   req.socket.setNoDelay( true );
   req.socket.setKeepAlive( true );
   res.setHeader('Content-Type', 'text/event-stream');
   res.setHeader('Cache-Control', 'no-cache');
   res.write( 'retry: 5000\n\n' );

   res.on( 'close', this.emit.bind( this, 'close' ) );
}

inherits( SSE, EventEmitter );

SSE.prototype.emit = function( event ) {
   var data = JSON.stringify( [].slice.call( arguments, 1 ) ).split(/(\r\n|\r|\n)/g);

   this.res.write( 'event: ' + event + '\n' );

   for( i=0; i < data.length; i++ ) {
      this.res.write( 'data: ' + data[ i ] + '\n' );
   }
   this.res.write( '\n' );

   EventEmitter.prototype.emit.apply( this, arguments );
};

SSE.prototype.close = function() {
   this.removeAllListeners();
   this.res.end();
};

module.exports = { SSE: SSE };
