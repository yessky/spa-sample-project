define(function(require, exports, module) {
	// author:
	// 		aaron.xiao<admin@veryos.com>
	exports.load = function(mid, req, cb) {
		return cb(req.toUrl(mid));
	};
});