define(function(require, exports, module) {
	//	module: Page
	//	summary:
	//		base Class for creating page

	var declare = require("base/declare");
	var has = require("base/sniff");
	var topic = require("base/topic");
	var ioquery = require("base/io-query");
	var dom = require("base/dom");
	var Widget = require("base/Widget");
	var config = require("./app.config");
	var routes = require("./routes");
	var templateString = require("base/text!./views/Page.html");
	require("./Header");

	return declare("app.Page", Widget, {
		widgetsInTemplate: true,
		baseClass: "page-entry",
		_templateString: templateString,
		templateString: "",

		location: "/",
		downloadUrl: false,

		// seo config
		seoTitle: "SPAN.IM",
		pageTitle: "",
		pageKeywords: "default page keywords",
		pageDescription: "default page description",
		_initPageSEO: function() {
			document.title = (this.pageTitle || "") + (this.pageTitle ? "-" : "") + this.seoTitle;
			dom.query('meta[name=keywords]').attr("content", this.pageKeywords);
			dom.query('meta[name=description]').attr("content", this.pageDescription);
		},

		isIOS: has("ios"),
		isAndroid: has("android"),


		postMixInProperties: function() {
			this.query = ioquery.location().param;
			this.pageClass = "ks-" + this.baseClass;
			this.inherited(arguments);
			this._initPageSEO();
			topic.publish("/app/page/init", this)
		},
		postCreate: function() {
			dom.addClass(this.ownerDocumentBody, this.pageClass);
			this.inherited(arguments);
			topic.publish("/app/page/create", this)
		},
		startup: function() {
			dom.addClass(this.domNode, "active");
			this.inherited(arguments);
			// force to reflow
			this.ownerDocumentBody.offsetWidth;
			topic.publish("/app/page/startup", this)
		},
		destroy: function() {
			dom.removeClass(this.ownerDocumentBody, this.pageClass);
			this.inherited(arguments);
			topic.publish("/app/page/destroy", this)
		}
	})
});