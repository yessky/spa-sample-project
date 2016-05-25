define(function(require, exports, module) {
	// module:
	// 		base/dom
	// summary:
	// 		dom utils delegate from jquery/zepto

	var $ = require("jquery");

	var jqWrap = function(fn) {
		return function() {
			var elem = arguments[0];
			var args = Array.prototype.slice.call(arguments, 1);
			var result;
			if (elem) {
				var jqelem = $(elem);
				result = jqelem[fn].apply(jqelem, args)
			}
			return result
		}
	};
	var jqGesture = function(fn) {
		return function(target, listener) {
			var jqelem = $(target);
			jqelem.on(fn, listener);
			return {
				remove: function() {
					jqelem.off(fn, listener)
				}
			}
		}
	};

	var cssPrefix = $.fx && $.fx.cssPrefix;
	var transitionEnd = $.fx && $.fx.transitionEnd;
	var animationEnd = $.fx && $.fx.animationEnd;
	if (!$.fx || !$.fx.hasOwnProperty("cssPrefix")) {
		var testEl = document.createElement('div');
		var vendors = {Webkit: 'webkit', Moz: '', O: 'o'};
		var eventPrefix;
		function normalizeEvent(name) { return eventPrefix ? eventPrefix + name : name.toLowerCase() }
		$.each(vendors, function(vendor, evt){
	    if (testEl.style[vendor + 'TransitionProperty'] !== undefined) {
	      prefix = '-' + vendor.toLowerCase() + '-'
	      eventPrefix = evt
	      return false
	    }
	  });
	  cssPrefix = prefix;
	  transitionEnd = normalizeEvent("TransitionEnd");
	  animationEnd = normalizeEvent("AnimationEnd")
	}

	var dom = {
		cssPrefix: cssPrefix,
		transitionEnd: transitionEnd,
		animationEnd: animationEnd,
		jqWrap: jqWrap,

		byId: function(id, doc) {
			return id.nodeType ? id : (doc || document).getElementById(id)
		},
		query: function(selector, context) {
			return $(selector, context)
		},
		place: function(node, refNode, position) {
			switch (position) {
				case "before":
					dom.before(refNode, node);
					break;
				case "after":
					dom.after(refNode, node);
					break;
				case "only":
					dom.empty(refNode);
					dom.append(refNode, node);
					break;
				case "first":
					if (refNode.firstChild) {
						dom.before(refNode.firstChild, node)
					} else {
						dom.append(refNode, node)
					}
					break;
				default:
					dom.append(refNode, node)
			}
		},
		create: function(tag, attrs, refNode, position) {
			var elem = document.createElement(tag);
			if (attrs) { dom.attr(elem, attrs) }
			if (refNode) { dom.place(elem, refNode, position) }
			return elem
		},
		formToObject: function(form, trim) {
			form = $(form);
			var data = {};
			if (trim === undefined) { trim = true }
			$.each(form.serializeArray(), function(i, field) {
				return data[field.name] = trim ? $.trim(field.value) : field.value
			});
			return data
		},

		matchesSelector: $.zepto ? $.zepto.matches : $.find.matchesSelector,
		contains: $.contains,
		parse: function(shtml) {
			var nodes = $(shtml);
			var fragment = document.createDocumentFragment();
			nodes.each(function(i, node) {
				return fragment.appendChild(node)
			});
			return fragment
		},
		matrix: function(elem) {
			var matrix = window.getComputedStyle(elem, null);
			matrix = matrix[cssPrefix + "transform"].split(")")[0].split(", ");
			return {
				x: +(matrix[12] || matrix[4] || 0),
				y: +(matrix[13] || matrix[5] || 0)
			}
		},
		isDescendant: function(node, ancestor) {
			try {
				while (node) {
					if (node === ancestor) { return true }
					node = node.parentNode
				}
			} catch (e) {}
			return false
		}
	};

	$.each([
		"hasClass", "addClass", "removeClass", "css", "attr", "removeAttr",
		"remove", "empty", "parent", "parents", "children", "siblings", "next", "prev",
		"prepend", "append", "prependTo", "appendTo", "before", "after",
		"html","val", "serializeArray", "show", "hide", "animate",
		"width", "height", "position", "offset", "scrollTop", "scrollLeft"
	], function(i, name) {
		dom[name] = jqWrap(name)
	});

	if ($.fn.swipeDown) {
		dom.gesture = {};
		$.each([
			"tap", "doubleTap", "longTap",
			"swipe", "swipeLeft", "swipeUp", "swipeRight", "swipeDown",
			"pinch", "pinchIn", "pinchOut"
		], function(i, name) {
			dom.gesture[name] = jqGesture(name)
		})
	}

	return dom
});