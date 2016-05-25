define(function(require, exports, module) {
	var declare = require("base/declare");
	var Widget = require("base/Widget");
	var dom = require("base/dom");
	var templateString = require("base/text!./views/Button.html");

	return declare("ui.Button", Widget, {
		baseClass: "inline ui-button",
		_templateString: "${X}",
		templateString: templateString,
		title: "",
		_titleSetter: function(title) {
			this.titleNode.innerHTML = title;
		},
		disabled: false,
		_disabledSetter: function(disabled) {
			dom[disabled ? "addClass" : "removeClass"](this.domNode, "ui-button-disabled")
		},
		onClick: function() {}
	})
});