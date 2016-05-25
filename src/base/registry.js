define(function(require, exports, module) {
	"use strict";
	// module:
	//		base/registry
	// summary:
	//		manipulate widgets

	var hash = {};
	var cache = {};

	return {
		uid: function(prefix) {
			prefix = prefix.replace(/\./g, "_").toLowerCase();
			var num = prefix in cache ? cache[prefix] : (cache[prefix] = -1);
			return prefix + "_" + (cache[prefix] = ++num)
		},

		length: 0,
		add: function(widget) {
			if (hash[widget.id]) {
				throw new Error('Widget with id "' + widget.id + '" is already registered!');
			}
			hash[widget.id] = widget;
			this.length++
		},
		remove: function(id) {
			if (hash[id]) {
				delete hash[id];
				this.length--
			}
		},

		byId: function(id) {
			return hash[id]
		},
		byNode: function(node) {
			return hash[node.getAttribute("widgetid")]
		},
		findWidgets: function(root, skipNode) {
			var out = [];
			function getChildren(root) {
				for (var node = root.firstChild; node; node = node.nextSibling) {
					if (node.nodeType === 1) {
						var widgetId = node.getAttribute("widgetid");
						if (widgetId) {
							var widget = hash[ widgetId ];
							if (widget) { out.push(widget) }
						} else if (node !== skipNode) {
							getChildren(node)
						}
					}
				}
			}
			return (getChildren(root), out)
		},
		getEnclosingWidget: function( node ) {
			while (node) {
				var id = node.nodeType === 1 && node.getAttribute("widgetid");
				if (id) { return hash[id] }
				node = node.parentNode
			}
			return null
		}
	}
});