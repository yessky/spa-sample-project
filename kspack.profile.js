var config = require("./config.json");

module.exports = {
	appBase: __dirname,
	output: {
		// cmd配置文件的baseUrl
		baseUrl: config.baseUrl,
		// 文件输出的目录
		path: __dirname + config.paths.dist,
		// 是否压缩js文件
		compress: true,
		// 文件名模版
		filename: "[name].[hash:8][ext]"
	},
	// 是否在控制台打印日志
	log: true,
	// 打包入口文件
	entry: {
		"app/entry.Home": "app/entry.Home",
		"app/entry.About": "app/entry.About"
	},
	// 单独打包三方模块及入口公用资源
	chunk: [
		{name: "app/vendor", type: "concat", assets: ["underscore", "jquery"]},
		{name: "app/common", type: "common"}
	],
	// cmd 模块资源映射等配置
	modular: {
		// loader url
		loader: "base/k.js",
		// loader base url
		baseUrl: ".temp/",
		// config for mid-to-moduleId map
		paths: {
			jquery: "vendor/zepto",
			underscore: "vendor/underscore"
		},
		// config for shim modules
		shim: {
			jquery: {
	      exports: '$'
	    },
	    flexible: {
	    	exports: 'lib'
	    },
	    zepto: {
	    	exports: "Zepto"
	    },
	    k: {
	    	exports: "require"
	    }
		},
		// 配置插件如何加载本地文件
		plugins: {
			"base/text": {
				// normalize: function() {},
				test: /\.(html|tpl|txt|css)$/,
				load: function(mid, req, cb) {
					return req.injectUrl(req.toUrl(mid), cb);
				}
			},
			"base/url": {
				test: /\.(jpg|gif|png|jpeg|svg|ico|webp)$/,
				copyonly: true,
				load: function(mid, req, cb) {
					return cb(req.toUrl(mid));
				}
			}
		}
	},
	// 优化所有未打包资源(可能是异步按需加载的资源)
	async: [
		"base/**/*.js",
		"ui/**/*.{js,html,css}",
		"vendor/**/*.js",
		"app/**/*.{js,html,css}",
		"images/**/*.{png,svg}"
	]
};