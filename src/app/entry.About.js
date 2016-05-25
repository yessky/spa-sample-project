define(function(require, exports, module) {
	// author:
	// 		aaron.xiao<admin@veryos.com>

	var declare = require("base/declare");
	var Page = require("./Page");
	var templateString = require("base/text!./views/entry.About.html");

	return declare("entry.About", [Page], {
		baseClass: "page-entry-about",
		templateString: templateString,
		location: "/about"
	})
});