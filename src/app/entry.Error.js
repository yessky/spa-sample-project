define(function(require, exports, module) {
	// author:
	// 		aaron.xiao<admin@veryos.com>

	var declare = require("base/declare");
	var Page = require("./Page");

	return declare("entry.Error", [Page], {
		baseClass: "page-entry-error",
		_templateString: "<div><h3>404 Not Found</h3><p>powered by span.im</p></div>",
		location: "/404"
	})
});