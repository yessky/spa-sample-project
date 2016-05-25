define(function(require, exports, module) {
	// module:
	//		base/_WidgetsInTemplateMixin
	// summary:
	//		Mixin to supplement _TemplatedMixin when template contains widgets

	var KS = require("./kernel");
	var lang = require("./lang");
	var declare = require("./declare");
	var parser = require("./parser");

	return declare("base._WidgetsInTemplateMixin", null, {
		// Should we parse the template to find widgets that might be
		// declared in markup inside it?
		widgetsInTemplate: false,

		// Used to provide a context require to the dojo/parser in order to be
		// able to use relative MIDs (e.g. `./Widget`) in the widget's template.
		contextRequire: null,

		__prefill: function() {
			if (this.widgetsInTemplate) {
				// Before copying over content, instantiate widgets in template
				var node = this.domNode;

				parser.parse(node, {
					noStart: true,
					template: true,
					context: this,
					contextRequire: this.contextRequire,
					scope: KS.config.scopeName
				}).then(lang.hitch(this, function(widgets) {
					this.__startupWidgets = widgets;

					// Hook up attached nodes and events for nodes that were converted to widgets
					for (var i = 0, l = widgets.length; i < l; ++i) {
						this.__process(widgets[i], function(n, p) {
							return n[p]
						}, function(widget, type, callback) {
							return widget.on(type, callback, true)
						})
					}
				}));

				if (!this.__startupWidgets) {
					throw new Error(this.declaredClass + ": parser returned unfilled promise (probably waiting for module auto-load), " + "unsupported by _WidgetsInTemplateMixin.   Must pre-load all supporting widgets before instantiation.")
				}
			}
		},

		__process: function(baseNode, getter, listen) {
			return getter(baseNode, "ks-type") ? true : this.inherited(arguments)
		},

		startup: function() {
			lang.forEach(this.__startupWidgets, function(widget) {
				if (widget && !widget._started && widget.startup) {
					widget.startup()
				}
			});
			delete this.__startupWidgets;
			this.inherited(arguments)
		}
	})
});