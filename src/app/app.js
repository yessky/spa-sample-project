// debug
require.on("trace", function(a, b, c) {
	if (a.indexOf("circular") > -1) {
		console.log("circular: ", a, b, c)
	}
});

require.on("error", function(e) {
	console.log(e)
});

define(function(require, exports, module) {
	// author:
	// 		aaron.xiao<admin@veryos.com>
	// summary:
	// 		app instance

	var lang = require("base/lang"); // lang.delay
	var kernel = require("base/kernel");
	var on = require("base/on");
	var topic = require("base/topic"); // topic.subscribe
	var dom = require("base/dom"); // dom.height
	var router = require("base/router"); // router.history.start
	var touch = require("base/touch"); // touch,tap

	var config = require("./app.config");
	var common = require("./common");
	var routes = require("./routes");
	var services = require("./services");

	kernel.txApp = {};

	function bootstrap() {
		// =======================================================
		// 添加快捷方式用于调试
		kernel.txApp.services = services;
		kernel.txApp.routes = routes;

		// =======================================================
		// 拦截页面超链接
		on.selector("a", touch.tap).call(this, document, function(e) {
			var route = dom.attr("href") && this.href;
			if (/^javascript:/.test(route)) { return }
			var extra = dom.attr(this, "data-extra");
			if (extra) { route += (route.indexOf("?") == -1 ? "?" : "&") + extra }
			e.preventDefault();
			routes.navigate(route, true)
		});

		topic.subscribe("/app/load/error", function(e) {
			common.consumeError(e, function(e) {
				if (e.type === "timeout") {
					alert("网络不给力~")
				} else if (e.type !== "abort") {
					alert(e.message)
				}
			})
		});

		// =======================================================
		// 启动路由
		router.history.start({ root: config.ROUTE_ROOT, pushState: true, silent: false })
	}

	// =======================================================
	// safe to start
	require.ready(function() {
		// 确保scroll事件触发
		dom.css(dom.byId("app-main"), "min-height", dom.height(window) + 1 + "px");
		// 获取用户信息并启动应用
		common.checkUser(true).always(bootstrap)
	})
});