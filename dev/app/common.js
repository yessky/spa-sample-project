define(function(require, exports, module) {
	// module: actions
	// summay:
	// 		common heloers

	var lang = require("base/lang");
	var has = require("base/sniff");
	var Deferred = require("base/Deferred");
	var dom = require("base/dom");
	var config = require("./app.config");
	var services = require("./services");

	// =======================================================
	// 用户信息管理
	var userInfo = {raw: null, lastUpdateTime: null, promise: null};
	var checkUserPromise = null;
	var tenMinutes = 10 * 60 * 1000;

	function getUser(prop) {
		if (!userInfo.raw) { return }
		return prop ? userInfo.raw[prop] : userInfo.raw
	}

	function setUser(props) {
		if (!userInfo.raw && lang.isPlainObject(props)) {
			return userInfo.raw = props
		}
		if (lang.isObject(props)) {
			return lang.mix(userInfo.raw, props)
		}
		return userInfo.raw = null
	}

	function checkUser(forceCheck, quiet) {
		if (!forceCheck && userInfo.lastUpdateTime && (lang.now() - userInfo.lastUpdateTime) < tenMinutes) {
			var def = new Deferred();
			def.resolve(getUser());
			return def.promise
		}
		// checking
		if (userInfo.promise) { return userInfo.promise }
		// process check
		var checkUserPromise = userInfo.promise = services.getUser({skipError: true, quiet: quiet});
		checkUserPromise.then(function(res) {
			if (res && res.resultCode == 200) { setUser(res.data) }
		}).always(function() {
			userInfo.lastUpdateTime = lang.now();
			userInfo.promise = null
		});
		return checkUserPromise
	}

	// =======================================================
	// exports
	var common = {
		// =======================================================
		// 异步加载模块及构造模块实例
		getCtor: function(mid) {
			var def = new Deferred();
			require.async([mid], function(ctor) {
				def.resolve(ctor)
			});
			return def.promise
		},
		getInstanceOf: function(mid, param, refNode) {
			var def = new Deferred();
			require.async([mid], function(ctor) {
				try {
					def.resolve(ctor(param, refNode))
				} catch (e) {
					def.reject({
						type: "rendering",
						code: -9999,
						message: e.message,
						rawError: e
					})
				}
			});
			return def.promise
		},

		// =======================================================
		// 公用错误处理
		consumeError: function(e, consumer) {
			if (!e || common.isConsumedError(e)) { return }
			e.consumed = true;
			consumer && consumer(e)
		},

		isConsumedError: function(e) {
			return e.consumed
		},

		// =======================================================
		// 用户信息获取
		setUser: setUser,
		getUser: getUser,
		checkUser: checkUser
	};

	return common
});