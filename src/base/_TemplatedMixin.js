define(function(require, exports, module) {
	// module:
	//		base/_TemplatedMixin
	// summary:
	//		Mixin for widgets that are instantiated from a template

	var lang = require("./lang");
	var declare = require("./declare");
	var dom = require("./dom");
	var _AttachMixin = require("./_AttachMixin");

	var _TemplatedMixin = declare("base._TemplatedMixin", _AttachMixin, {
		// A string(maybe function) that represents the widget template.
		templateString: null,

		// indicate if the server has already rendered the template,
		_rendered: false,

		// escape string
		escapeHTML: lang.escape,

		buildRendering: function() {
			if (!this.__rendered) {
				var source = this.templateString;
				var compiled = lang.isFunction(source);
				if (!compiled) {
					source = source.replace(/>([\n\t]*)</g, "><");
				}
				var render = compiled ? source : _TemplatedMixin.compile(source);
				var fragment = dom.parse(render(this));
				if (fragment.childNodes.length !== 1) {
					throw new Error("Invalid template: " + (compiled ? source.source : source))
				}
				var node = fragment.childNodes[0];
				this.domNode = node
			}

			// Call down to _WidgetBase.buildRendering()
			this.inherited(arguments);

			if (!this.__rendered) {
				this.__fill(this.srcNodeRef)
			}

			this.__rendered = true
		},

		__fill: function(source) {
			var dest = this.containerNode;
			if (source && dest) {
				while (source.hasChildNodes()) {
					dest.appendChild(source.firstChild)
				}
			}
		}
	});

	_TemplatedMixin.cache = {};
	_TemplatedMixin.compile = function(templateString) {
		var cached = _TemplatedMixin.cache;
		var name = lang.trim(templateString);
		var result = cached[name];
		if (!result) {
			result = cached[name] = lang.template(templateString = name)
		}
		return result
	};

	return _TemplatedMixin
});