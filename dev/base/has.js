
define(function(require, exports, module) {	// module: has
	// summary:
	// 		minimal has.js API
	
	var global = this;
	var doc = document;
	var strundef = "undefined";
	var isBrowser =
		typeof window !== strundef &&
		typeof location !== strundef &&
		typeof document !== strundef &&
		window.location === location && window.document === document;

	// ========================================
	// # a simple has.js api
	var element = doc.createElement('DiV');
	var cache = {};

	var has = function( name ) {
		return typeof cache[name] === 'function' ?
			(cache[name] = cache[name]( global, doc, element )) :
			cache[name];
	};

	has.add = function( name, test, now, force ) {
		(cache[name] === undefined || force) && (cache[name] = test);
		return now && has( name );
	};

	has.add('bug-for-in-skips-shadowed', function() {
		for ( var i in {toString: 1} ) {
			return 0;
		}
		return 1;
	});

	has.add( 'host-browser', isBrowser );
	has.add( 'dom', isBrowser );

	if ( has('host-browser') ) {
		has.add('dom-addeventlistener', !!document.addEventListener);
		has.add('pointer-events', 'onpointerdown' in document);
		has.add('MSPointer', 'msMaxTouchPoints' in navigator);
		has.add('touch', 'ontouchstart' in document
			|| ('onpointerdown' in document && navigator.maxTouchPoints > 0)
			|| window.navigator.msMaxTouchPoints);
		has.add('touch-events', 'ontouchstart' in document);
		has.add('device-width', screen.availWidth || innerWidth);
	}

	module.exports = has;
});