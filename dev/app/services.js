define(function(require, exports, module) {
	// author:
	// 		aaron.xiao<admin@veryos.com>
	// summary:
	// 		fetch and format data

	var lang = require("base/lang");
	var Deferred = require("base/Deferred");
	var config = require("./app.config");
	var ajax = require("./ajax");

	var API_BASE = config.API_BASE;

	function fetchApi(url, data, option) {
		url = API_BASE + url;
		option = option || {};
		if (option.cache === undefined) {
			option.cache = false
		}
		return ajax(lang.mix({ url: url, data: data }, option))
	}

	function doFetch(url, data, option) {
		url = url + ".json";
		return fetchApi(url, data, option)
	}

	var services = {};

	services.getUser = function(data, option) {
		return doFetch("/user", data, option)
	};

	// =================================
	// 获取首页数据
	services.getEntryHome = function(data, option) {
		return doFetch("/home", data, option)
	};

	// 获取About页数据
	services.getEntryAbout = function(data, option) {
		return doFetch("/about", data, option)
	};

	return services
});