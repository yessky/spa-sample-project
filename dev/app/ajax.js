define(function(require, exports, module) {
	// module: ajax
	// summay:
	// 		synth ajax apis

	var lang = require("base/lang");
	var Deferred = require("base/Deferred");
	var topic = require("base/topic");
	var json = require("base/json");
	var request = require("jquery").ajax;
	var config = require("./app.config");

	var requests = 0;
	var flights = 0;
	var idleTimer = null;

	// TODO: fix loader idle status check
	/*require.on("idle", function() {
		if (flights === 0 && require.idle()) {
			idleTimer = lang.delay(function() {
				topic.publish("/app/load/idle")
			}, 200)
		}
	});*/

	function onLoadComplete(xhr, promise, param) {
		var index = lang.indexOf(ajax.stack, promise);
		if (index !== -1) {
			ajax.stack.splice(index, 1)
		}
		requests -= 1;
		if (!param.quiet) { flights -= 1; }
		topic.publish("/app/load/complete", xhr);
		if (flights === 0/* && require.idle()*/) {
			idleTimer = lang.delay(function() {
				topic.publish("/app/load/idle")
			}, 200)
		}
	}

	function onLoadStart(param) {
		if (!param.quiet && idleTimer) {
			idleTimer.remove();
			idleTimer = null
		}
		if (!param.quiet && !flights) {
			topic.publish("/app/load/start", param)
		}
		requests += 1;
		if (!param.quiet) { flights += 1 }
	}

	function serializeParam(data, type) {
		return data && type.toLowerCase() === "json" ? json.stringify(data) : data
	}

	function ajax(param) {
		var xhr;
		var deferred = new Deferred(function() {
			xhr && xhr.abort();
			topic.publish("/app/load/abort", xhr)
		});
		onLoadStart(param);
		var promise = deferred.promise;
		var type = param.type || "GET";
		var dataType = param.dataType || "json";
		var paramType = param.paramType || "query";
		var contentType = param.contentType || "application/json;charset=UTF-8";
		var data = param.data ? serializeParam(param.data, paramType) : param.data;
		var opts = {
			url: param.url,
			contentType: contentType,
			dataType: dataType,
			type: type,
			data: data,
			headers: param.headers,
			timeout: ajax.timeout * 1000,
			cache: param.cache !== undefined ? param.cache : false,
			skipError: param.skipError
		};
		xhr = request(opts);
		ajax.stack.push(promise);
		xhr.then(
			function(data, textStatus, jqXHR) {
				var code, detail;
				if (dataType === "json" && param.skipError) {
					deferred.resolve(data)
				} else if (
					dataType !== "json" ||
					+(code = (data.error ? data.error.code : data.resultCode) || 200) === 200
				) {
					deferred.resolve(dataType === "json" ? data.data : data);
					topic.publish("/app/load/success", { data: data, xhr: jqXHR, param: opts })
				} else {
		 			detail = {
		 				catchFrom: "apiError",
		 				xhr: jqXHR,
		 				type: "api",
		 				code: +(data.error ? data.error.code : data.resultCode) || -99999,
		 				message: (data.error ? data.error.message : data.resultDesc) || "unknow"
		 			};
					deferred.reject(detail);
					if (!param.skipError) {
						topic.publish("/app/load/error", detail);
					}
				}
				onLoadComplete(xhr, promise, param)
			},
			function(jqXHR, textStatus, error) {
				var detail = {
					catchFrom: "ajaxError",
					xhr: jqXHR,
					type: textStatus,
					code: error && error.code || jqXHR.status || -99999,
					message: error && error.message || jqXHR.statusText || "unknow",
					rawError: error
				};
				deferred.reject(detail);
				if (!param.skipError) {
					topic.publish("/app/load/error", detail);
				}
				onLoadComplete(xhr, promise, param)
			}
		);
		return promise
	}

	lang.mix(ajax, {
		timeout: config.AJAX_TIMEOUT || 10, // unit: seconds
		stack: [],
		abort: function() {
			var stack = ajax.stack.slice(0);
			ajax.stack = [];
			lang.forEach(stack, function(promise) {
				if (!promise.isFulfilled()) {
					promise.cancel({type: "abort"})
				}
			});
			stack = null
		},
		parallel: function(xhrQ) {
			var promises = [];
			var result = {};
			lang.forEach(xhrQ, function(xhr, i) {
				var promise = ajax(xhr);
				promises.push(promise);
				promise.then(function(data) {
					var alias = xhr.alias || (i + "");
					data.__alias = alias;
					result[alias] = data
				})
			});
			var promise = Deferred.ensure(promises, true);
			var deferred = new Deferred(function(reason) {
				promise.cancel(reason)
			});
			promise.then(function() {
				deferred.resolve(result)
			}, function(e) {
				deferred.reject(e)
			});
			return deferred.promise
		},
		serializeParam: serializeParam,
		getFlight: function() {
			return flights
		}
	});

	// shortcut
	ajax.load = ajax;
	ajax.request = ajax.parallel;

	return ajax
});