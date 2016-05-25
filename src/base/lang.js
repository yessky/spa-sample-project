define(function(require, exports, module) {
	// author:
	//		aaron.xiao<admin@veryos.com>
	// summary:
	//		javascript language fixes and extensions
	"use strict";

	var _ = require("underscore");
	var has = require("./has");

	var	ObjectProto = Object.prototype;
	var	toString = ObjectProto.toString;
	var	hasOwn = ObjectProto.hasOwnProperty;
	var	slice = Array.prototype.slice;
	var nativeTrim = String.prototype.trim;
	var	trimLeft = /^[\x20\t\n\r\f]+/;
	var	trimRight = /[\x20\t\n\r\f]+$/;
	var	rmsPrefix = /^-ms-/;
	var	rdashAlpha = /-([\da-z])/gi;

	var delegate = (function() {
		function TMP() {}
		return function(o, props) {
			TMP.prototype = o;
			var obj = new TMP();
			TMP.prototype = null;
			if (props) { mix(obj, props) }
			return obj
		};
	})();
	var lang = delegate(_, {});

	function getType(o) {
		if (o == null) { return String(o) }
		return (toString.call(o).match(/\[\w+\s*(\w+)\]/ )[1] || 'object').toLowerCase()
	}

	function mix(dest, source, mixFunc) {
		var empty = {};
		for (var name in source) {
			var s = source[name];
			if (!(name in dest) || (dest[name] !== s &&
				(!(name in empty) || empty[name] !== s))) {
				dest[name] = mixFunc ? mixFunc(name, s) : s
			}
		}
		return dest
	}

	function clone(src) {
		if (!src || typeof src != 'object' || _.isFunction(src)) {
			return src
		}
		if (src.nodeType && 'cloneNode' in src) {
			return src.cloneNode(true)
		}
		if (src instanceof Date) {
			return new Date(src.getTime())
		}
		if (src instanceof RegExp) {
			return new RegExp(src)
		}
		var result = [];
		if (_.isArray(src)) {
			for (var i = 0, l = src.length; i < l; ++i) {
				if (i in src) { result.push(clone(src[i])) }
			}
		} else {
			result = src.constructor ? new src.constructor() : {}
		}
		return mix(result, src, clone);
	}

	function fcamelCase( all, letter ) {
		return letter.toUpperCase();
	}

	_.extend(lang, {
		noop: function() {},
		type: getType,
		isArrayLike: function(o) {
			var length = o.length;
			var type = getType(o);
			if (o.nodeType === 1 && typeof length === 'number' && o.nodeName.toLowerCase() === 'form') {
				return true
			}
			return type === 'array' || type !== 'function' &&
				(length === 0 ||
				typeof length === 'number' && length > 0 && (length - 1) in o)
		},
		isEmptyObject: function(o) {
			for (var p in o) { return false }
			return true
		},
		isPlainObject: function(o) {
			if (!o || getType(o) !== 'object' || o.nodeType || o.window === o) {
				return false
			}
			try {
				if (o.constructor &&
					!hasOwn.call(o, 'constructor') &&
					!hasOwn.call(o.constructor.prototype, 'isPrototypeOf')) {
					return false
				}
			} catch ( e ) {
				return false
			}
			for (var key in o) {}
			return key === undefined || hasOwn.call(o, key)
		},
		trim: function(str) {
			if (str && _.isString(str)) {
				return nativeTrim ? str.trim() : str.replace(trimLeft, '').replace(trimRight, '')
			}
			return str
		},
		clone: clone,
		camelize: function(str) {
			return str.replace(rmsPrefix, 'ms-').replace(rdashAlpha, fcamelCase)
		},
		mix: function( dest, sources ) {
			if (!dest) { dest = {} }
			for (var i = 1, l = arguments.length; i < l; i++) {
				mix(dest, arguments[i])
			}
			return dest
		},
		delegate: delegate,
		hitch: function(scope, method) {
			var pre = slice.call(arguments, 2);
			if (!method) {
				method = scope;
				scope = null;
			}
			if (_.isString(method)) {
				scope = scope || window;
				return function() {
					var fn = scope[method];
					if (!fn) {
						throw (['lang.hitch: scope["', method, '"] is null (scope="', scope, '")'].join(''))
					}
					var args = pre.concat(slice.call(arguments));
					return fn.apply(scope, args);
				}
			}
			return !scope ? method : function() {
				var args = pre.concat(slice.call(arguments));
				return method.apply(scope,args);
			}
		},
		delay: function(fn, delay) {
			var tick = _.delay(fn, delay);
			return {
				remove: function() {
					clearTimeout(tick)
				}
			}
		}
	});

	return lang;
});