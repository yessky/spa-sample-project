define(function(require, exports, module) {
	//	module: base/Widget
	//	summary:
	//		base Class for creating ui widget

	var declare = require("base/declare");
	var _WidgetBase = require("./_WidgetBase");
	var _TemplatedMixin = require("./_TemplatedMixin");
	var _WidgetsInTemplateMixin = require("./_WidgetsInTemplateMixin");

	return declare("base.Widget", [_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
		_templateString: '<div class="<%=baseClass%>" id="<%=id%>">${X}</div>',
		templateString: "",
		widgetsInTemplate: true,
		postMixInProperties: function() {
			this.templateString = this._templateString.replace("${X}", this.templateString);
			this.inherited(arguments)
		}
	})
});