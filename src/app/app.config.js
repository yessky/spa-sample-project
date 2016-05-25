define(function(require, exports, module) {
	// author:
	// 		aaron.xiao<admin@veryos.com>
	// summary:
	// 		app 全局配置

	var ROUTE_ROOT = "/";
	var APP_HOST = location.protocol + "//" + location.host + "/";

	return {
		// 客户端路由根路径
		ROUTE_ROOT: ROUTE_ROOT,
		// APP host
		APP_HOST: APP_HOST,
		APP_PATH: APP_HOST + (ROUTE_ROOT.length > 1 ? ROUTE_ROOT.substring(1) + "/" : ""),
		// 后端API接口根路径
		API_BASE: "/mock-json",
		// APP下载链接
		APP_DOWNLOAD_LINK: "http://veryos.com",
		// APP登录授权地址
		APP_AUTH_LINK: "http://veryos.com",
		// APP用户中心地址
		APP_USER_CENTER: "http://veryos.com",
		// APP home
		APP_HOME: "/recommend",
		// Toaster close delay time (unit: seconds)
		TOASTER_DELAY: 1.5,
		// Ajax timeout (unit: seconds)
		AJAX_TIMEOUT: 10
	}
});