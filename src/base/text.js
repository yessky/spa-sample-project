define(function(require, exports, module) {
	// author:
	// 		aaron.xiao<admin@veryos.com>
	var ajax = require("jquery").ajax;
	exports.load = function(url, req, cb) {
		return ajax({
			url: req.toUrl(url),
			type: "GET",
			dataType: "text"
		}).then(cb)
	}
});