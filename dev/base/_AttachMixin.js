define(function(require, array, connect, declare, lang, mouse, on, touch, _WidgetBase) {
	// module:
	//		base/_AttachMixin
	// summary:
	//		Mixin for widgets to attach to dom nodes and setup events

	var lang = require("./lang");
	var declare = require("./declare");
	var on = require("./on");
	var mouse = require("./mouse");
	var touch = require("./touch");

	// Map from string name like "mouseenter" to synthetic event like mouse.enter
	var synthEvents = lang.delegate(touch, {
		"mouseenter": mouse.enter,
		"mouseleave": mouse.leave
	});

	return declare("base._AttachMixin", null, {
		constructor: function() {
			this.__nodes = [];
			this.__events = []
		},

		buildRendering: function() {
			this.inherited(arguments);
			// recurse through the node, looking for, and attaching to, our
			// attachment points and events, which should be defined on the template node.
			this.__attach(this.domNode);
			this.__prefill()
		},

		__prefill: lang.noop,

		__attach: function(rootNode) {
			var node = rootNode;
			while (true) {
				if (node.nodeType == 1 && (this.__process(node, function(n, p) {
					return n.getAttribute(p)
				}, this.__listen)) && node.firstChild) {
					node = node.firstChild
				} else {
					if (node == rootNode) { return }
					while (!node.nextSibling) {
						node = node.parentNode;
						if (node == rootNode) { return }
					}
					node = node.nextSibling
				}
			}
		},

		// process ks-node and ks-event for given node or widget.
		__process: function(baseNode, getter, listen) {
			var down = true;
			var atscope = this.attachScope || this;

			// process ks-node
			var atnode = getter(baseNode, "ks-node");
			if (atnode) {
				var node, nodes = atnode.split(/\s*,\s*/);
				while ((node = nodes.shift())) {
					if (lang.isArray(atscope[node])) {
						atscope[node].push(baseNode)
					} else {
						atscope[node] = baseNode
					}
					dow = (node != "containerNode");
					this.__nodes.push(node)
				}
			}

			// process ks-event
			var atevent = getter(baseNode, "ks-event");
			if (atevent) {
				var event, events = atevent.split(/\s*,\s*/);
				var trim = lang.trim;
				while ((event = events.shift())) {
					if (event) {
						var thisFunc = null;
						if (event.indexOf(":") !== -1) {
							var funcNameArr = event.split(":");
							event = trim(funcNameArr[0]);
							thisFunc = trim(funcNameArr[1])
						} else {
							event = trim(event)
						}
						if (!thisFunc) {
							thisFunc = event
						}
						this.__events.push(listen(baseNode, event, lang.hitch(atscope, thisFunc)))
					}
				}
			}

			return down
		},

		// bind event to node
		__listen: function(node, type, listener) {
			type = type.replace(/^on/, "");
			// support synth events
			// like: touch.press/mouseleave/tap etc.
			var selector = type.match(/(.*)@(.*)/);
			if (selector && synthEvents[selector[1]]) {
				type = synthEvents[selector[1]];
				selector = selector[2];
				return on.selector(selector, type).call(this, node, listener)
			}
			type = synthEvents[type] || type;
			return on(node, type, listener)
		},

		//	detach nodes and events
		__detach: function() {
			// release all attached nodes.
			var atscope = this.attachScope || this;
			lang.forEach(this.__nodes, function(node) {
				delete atscope[node]
			});
			this.__nodes = [];

			// remove event listeners
			lang.forEach(this.__events, function(handle) {
				handle.remove()
			});
			this.__events = []
		},

		destroyRendering: function() {
			this.__detach();
			this.inherited(arguments)
		}
	})
});