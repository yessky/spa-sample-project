define(function(require, exports, module) {
	// author:
	// 		aaron.xiao<admin@veryos.com>
	
	var lang = require("base/lang");
	var declare = require("base/declare");
	var Page = require("./Page");
	var config = require("./app.config");
	var templateString = require("base/text!./views/entry.Home.html");
	require("ui/Button");

	return declare("entry.Home", Page, {
		baseClass: "page-entry-home",
		templateString: templateString,

		downloadUrl: config.APP_DOWNLOAD_LINK,

		// seo settings
		pageTitle: "Home Page",
		pageKeywords: "Home Page Keywords",
		pageDescription: "Home Page Description",

		onClickButton1: function() {
			this.button1._clicked = (this.button1._clicked || 0) + 1;
			this.button1.set("title", "ui/Button 1 clicked " + this.button1._clicked + " times");
		},
		onClickButton2: function() {
			this.button2.set("disabled", !this.button2.disabled)
		},

		onClickIcon: function(e) {
			alert("you clicked the " + e.expectedTarget.getAttribute("data-section") + " icon.")
		}
	})
});