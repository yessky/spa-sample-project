define(function(require, exports, module) {
	// author:
	// 		aaron.xiao<admin@veryos.com>

	var declare = require("base/declare");
	var dom = require("base/dom");
	var Widget = require("base/Widget");
	var routes = require("./routes");
	var logoUrl = require("base/url!../images/logo.png");
	var loveIconUrl = require("base/url!../images/sprite.png");
	var templateString = require("base/text!./views/Header.html");

	return declare("app.Header", Widget, {
		baseClass: "app-header",
		templateString: templateString,
		logoUrl: logoUrl,
		loveIconUrl: loveIconUrl,

		location: "/",
		_locationSetter: function(loc) {
			dom.html(this.locationNode, loc)
		},

		onClickLogo: function() {
			routes.navigate("/", true)
		}
	})
});