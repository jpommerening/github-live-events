var package = require( './package.json' );

function pick( source, mapkey, keys ) {
   return keys.reduce( function( object, key ) {
      if( source.hasOwnProperty( key ) ) {
         object[ mapkey( key ) ] = source[ key ];
      }
      return object;
   }, {} );
}

function defaults() {
   return [].reduce.call( arguments, function( object, source ) {
      for( var key in source ) {
         if( source.hasOwnProperty( key ) && !object.hasOwnProperty( key ) ) {
            object[ key ] = source[ key ];
         }
      }
      return object;
   } );
}

function toCamelCase( string ) {
   return string.replace( /_./g, function( match ) {
      return match[1].toUpperCase();
   } );
}

function fromEnv( string ) {
   return toCamelCase( string.toLowerCase() );
}

function fromNpmEnv( string ) {
   return fromEnv( string.replace( /^npm_package_config_/i, '' ) );
}

var keys = [ 'PORT', 'HOSTNAME', 'LOG_LEVEL', 'CLIENT_ID', 'CLIENT_SECRET', 'WEBHOOK_SECRET', 'GITHUB_URL' ];

module.exports = defaults(
   pick( process.env, fromEnv, keys ),
   pick( process.env, fromNpmEnv, keys.map( function( key ) { return 'NPM_PACKAGE_CONFIG_' + key; } ) ),
   pick( package.config, toCamelCase, [ 'port', 'hostname', 'log_level', 'github_url' ] ),
   {
      name: package.name,
      version: package.version
   }
);
