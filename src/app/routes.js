define(function(require, exports, module) {
	// author:
	// 		aaron.xiao<admin@veryos.com>
	// summary:
	// 		app routes

	var lang = require("base/lang");
	var declare = require("base/declare");
	var Deferred = require("base/Deferred");
	var router = require("base/router");
	var topic = require("base/topic");
	var dom = require("base/dom");
	var config = require("./app.config");
	var common = require("./common");
	var services = require("./services");

	function peekRev(array, offset) {
		offset = offset || 1;
		return array[array.length - offset]
	} 

	var Router = declare("app.Router", router.Router, {
		initialize: function() {
			var registry = lang.hitch(this, "route");
			var transform = lang.hitch(this, "transform");
			// # 404
			registry("*action", "404", function() {
				routes.navigate("/404", true, true)
			});
			// # error 404
			registry("404(/)(?:query)", "errror.404", function() {
				transform("app/entry.Error")
			});
			// # home
			registry("(?:query)", "home", function(q) {
				transform("app/entry.Home", null, services.getEntryHome())
			});
			// # about
			registry("about(/)(?:query)", "toplist", function() {
				transform("app/entry.About", null, services.getEntryAbout())
			});
		},
		execute: function() {
			var route = routes.getFragment();
			// cancel current transform since a new transform may start
			if (this._promiser && !this._promiser.isFulfilled() && !this._promiser.isCanceled()) {
				this._promiser.cancel({type: "abort"});
				delete this._promiser
			}
			// mark if the route is backward/forward
			routes.refreshState(route);
			// notify subscribers
			topic.publish("/app/route/access", route);
			this.inherited(arguments)
		},
		transform: function(mid, param, promise) {
			// speed-up, parallelly load apis and modules 
			this._promiser = Deferred.ensure({
				data: promise,
				ctor: common.getCtor(mid)
			}, true);
			// 渲染新页面及处理错误
			this._promiser.then(
				lang.hitch(this, function(result) {
					var page, error;
					param = param || {};
					if (result.data) { param.data = result.data }
					// 渲染
					try { page = result.ctor(param) } catch (e) { error = e }
					// 完成渲染并处理错误
					if (error) {
						this.onTransformError({
							type: "rendering",
							message: error.message,
							code: error.code || -99999,
							rawError: error
						})
					} else {
						this.onTransformEnd(page)
					}
				}),
				lang.hitch(this, "onTransformError")
			)
		},
		// 页面渲染完成，插入文档中
		onTransformEnd: function(page) {
			if (common.viewport) {
				try { common.viewport.destroy() } catch (e) {}
			}
			page.placeAt("app-main", "only");
			common.viewport = page
		},
		// 处理错误
		onTransformError: function(e) {
			common.consumeError(e, function(e) {
				var route = routes.getFragment();
				// for debug
				if (console) {
					if (console.error) {
						console.error(e)
					} else if (console.log) {
						console.log(e)
					}
				}
				if (e.type === "api" && e.code == 402) {
					return topic.publish("/app/route/reject", route)
				} else if (e.type !== "abort") {
					var url = encodeURIComponent("/" + route);
					routes.navigate("/404?url=" + url, true, true)
				}
			})
		}
	});

	var historyTrace = [];

	var routes = {
		router: new Router(),
		history: [],
		refreshState: function(route) {
			var last = peekRev(historyTrace);
			var prev = peekRev(historyTrace, 2);
			if (prev !== undefined && route === prev) {
				routes.isBackward = true;
				historyTrace.pop()
			} else if (last !== route) {
				historyTrace.push(route)
			}
		},
		getFragment: function() {
			return router.history.getFragment()
		},
		back: function() {
			if (historyTrace.length < 2) {
				routes.navigate(config.APP_HOME, true)
			} else {
				window.history.back()
			}
		},
		navigate: function(route, trigger, replace) {
			var prefix = config.APP_HOST;
			var notcros = route.indexOf("://") === -1 || route.indexOf(prefix) === 0;
			if (!notcros) {
				window.location.href = route
			} else {
				if (route.indexOf(prefix) === 0) {
					route = route.replace(prefix, "")
				}
				route = route.replace(/^(\/|#)+/, "");
				return routes.router.navigate(route, {
					trigger: trigger === undefined ? true : trigger,
					replace: replace === undefined ? false : replace
				})
			}
		}
	};

	return routes
});