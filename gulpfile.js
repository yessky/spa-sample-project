var gulp = require("gulp")
	, gutil = require("gulp-util")
	, config = require("./config.json")

	, del = require("del")
	, sass = require("gulp-sass")
	, rename = require("gulp-rename")

	, browserSync = require("browser-sync").create()
	, reload = browserSync.reload

	, sequence = require("run-sequence")
	, spritesmith = require("gulp.spritesmith")
	, svgmin = require("gulp-svgmin")
	, svgstore = require("gulp-svgstore")
	, plumber = require("gulp-plumber")
	, watch = require("gulp-watch")

	, KSPACK = require("./kspack")
	, ksprofile = require("./kspack.profile")

	, _ = require("underscore")
	, through2 = require("through2")
	, path = require("path")
	, fs = require("fs");

// 构建参数配置
var release = false;
var hotcached = {};
var runTimestamp = Math.round(Date.now()/1000);
var reloadTimer = null;
var copyUrl = null;

var paths = {
	src: __dirname + config.paths.src,
	dev: __dirname + config.paths.dev,
	temp: __dirname + config.paths.temp,
	dist: __dirname + config.paths.dist
}

// # clean
gulp.task("clean:temp", function () {
	return del([paths.temp]);
});

gulp.task("clean:dev", function () {
	return del([paths.dev]);
});

gulp.task("clean:dist", function () {
	return del([paths.dist]);
});

// # 生成loader配置文件
gulp.task("config:loader", function() {
	var dest = paths.src + "/app";
	return gulp.src("./loader.config.js.tpl")
		.pipe(rename(function(path) {
			path.basename = "loader.config";
			path.extname = ".js";
			return path;
		}))
		.pipe(through2.obj(function(file, enc, cb) {
			var result = _.template(file.contents.toString())(config);
			file.contents = new Buffer(result);
			this.push(file);
			cb();
		}))
		.on("error", console.log)
		.pipe(gulp.dest(dest))
});

// # 生成loader配置文件
gulp.task("config:app", function() {
	var dest = paths.src + "/app";
	return gulp.src("./app.config.js.tpl")
		.pipe(rename(function(path) {
			path.basename = "app.config";
			path.extname = ".js";
			return path;
		}))
		.pipe(through2.obj(function(file, enc, cb) {
			var result = _.template(file.contents.toString())(config);
			file.contents = new Buffer(result);
			this.push(file);
			cb();
		}))
		.on("error", console.log)
		.pipe(gulp.dest(dest))
});

// svg sprite
gulp.task("svgsprite", function() {
	var base = paths.src + "/slices/icons";
	var dest = paths.src + "/images";
	return gulp.src([base + "/**/*.svg"], {base: base})
		.pipe(plumber())
		.pipe(rename({prefix: 'icon-'}))
		.pipe(svgmin({
			plugins: [
				{ removeTitle: true },
				{ removeDesc: true },
				{ removeUselessDefs: true },
				{ removeUnknownsAndDefaults: true },
				{ removeUselessStrokeAndFill: true },
				{ convertTransform: true },
				{ mergePaths: true },
				{ convertPathData: false },
				{ convertShapeToPath: true },
				{ removeStyleElement: true },
				{ removeAttrs: {attrs: "(class|style|fill|data-.*)"} }
			]
		}))
		.pipe(svgstore( {inlineSvg: true} ))
		.pipe(gulp.dest(dest));
});


// # 编译css
gulp.task("sass", function() {
	var base = paths.src;
	var dest = release ? paths.temp : paths.dev;
	return gulp.src(base + "/{ui,app}/styles/**/*.scss", {base: base})
		.pipe(plumber())
		.pipe(sass({
			precision: 2,
			outputStyle: release ? "compressed" : "expanded",
			sourceComments: release ? false : true
		})
		.on("error", sass.logError))
		.pipe(gulp.dest(dest));
});


// # 复制静态资源
gulp.task("copy", function() {
	var base = paths.src;
	var dest = release ? paths.temp : paths.dev;
	return gulp.src(copyUrl ? [copyUrl] : [
			base + "/*.ico",
			base + "/fonts/*",
			base + "/{vendor,base,ui,app,images,mock-json}/**/*.{html,js,css,png,svg,gif,jpg,json}"
		], {base: base})
		.pipe(gulp.dest(dest));
});

gulp.task("copy:dist", function() {
	var base = paths.temp;
	var dest = paths.dist;
	return gulp.src([
			base + "/*.ico",
			base + "/fonts/*",
			base + "/mock-json/*"
		], {base: base})
		.pipe(gulp.dest(dest));
});


// # amd模块构建打包
gulp.task("kspack", function(cb) {
	var packer = new KSPACK(ksprofile);
	packer.on("complete", function(data) {
		var loaderConfig = {
			baseUrl: config.baseUrl,
			paths: data.map
		};
		data.config = loaderConfig;
		fs.writeFileSync("./release.stats.json", JSON.stringify(data));
		var url = data.manifest["app/loader.config.js"];
		fs.writeFileSync(
			paths.dist + "/" + url,
			KSPACK.minifyjs("require=" + JSON.stringify(loaderConfig))
		);
		cb();
	});
	packer.build();
});


// # 将相关资源写入html
gulp.task("import", function() {
	var base = paths.src;
	var src = release ? paths.temp : paths.dev;
	var dest = release ? paths.dist : paths.dev;

	function hotreload(dest, isRelease) {
		var importTpl = '<$0 filepath="$1"$3>$2</$0>';
		var linkTpl = '<$0 $1="$2"$3></$0>';
		var rimport = /<!--\s+(import|link)\((.+?)\)\s+-->/g;
		var stats = isRelease ? require("./release.stats.json") : {};
		var has = {};
		return through2.obj(function(file, enc, cb) {
			var raw = file.contents.toString();
			raw = raw.replace(rimport, function(a, t, src) {
				var abs = path.join(dest, src);
				var rel = path.relative(dest, abs).replace(/\\/g, "/");
				var ext = path.parse(src).ext;
				var url = src;
				if (isRelease && stats.manifest[rel]) {
					abs = path.join(stats.output.path, stats.manifest[rel]);
					url = "/" + stats.manifest[rel];
				}
				url = url;
				var map = [];
				if (t === "import") {
					map = [
						ext === ".svg" ? "p" : ext === ".js" ? "script" : "style",
						url,
						has[abs] || (has[abs] = fs.readFileSync(abs, "utf-8")),
						ext === ".svg" ? ' style="display:none"' : ''
					];
					hotcached[src] = src;
				} else {
					map = [
						ext === ".js" ? "script" : "link",
						ext === ".js" ? "src" : "href",
						url,
						ext === ".css" ? ' rel="stylesheet"' : ""
					];
				}
				return (t === "import" ? importTpl : linkTpl).replace(/\$(\d+)/g, function(a, i) {
					return map[i];
				});
			});
			file.contents = new Buffer(raw);
			this.push(file);
			cb();
		})
	}

	return gulp.src(base + "/*.html", {base: base})
		.pipe(plumber())
		.pipe(through2.obj(function(file, enc, cb) {
			var url = file.path.replace(base, "");
			hotcached[url] = url;
			this.push(file);
			cb();
		}))
		.on("error", console.log)
		.pipe(hotreload(src, !!release))
		.pipe(gulp.dest(dest));
});


// # start web server
gulp.task("server", function() {
	browserSync.init({
		ui: false
		, port: 5001
		, proxy: "localhost:5000"
		, notify: false
	});

	// # watch src资源, 调用相关任务预处理
	watch(paths.src + "/**/*", function(obj) {
		var url = obj.path.replace(/\\/g, "/");
		var absurl = url;
		url = path.relative(paths.src, url);
		var tasks = [];
		console.log("[KS] " + url);

		// svg slices
		if (/slices\/.+\.svg$/.test(url)) {
			tasks.push("svgsprite");
		}

		// png slices
		if (/slices\/.+\.png$/.test(url)) {
			tasks.push("iconsprite");
		}

		// scss
		if (/\.scss$/.test(url)) {
			tasks.push("sass");
		}

		if (/\.ico$|(?:base|vendor|ui|app|images|mock-json)\/.*?\.(?:html|js|css|png|svg|jpg|gif|ttf|woff|eot|json)$/.test(url)) {
			copyUrl = absurl;
			tasks.push("copy");
		}

		// if (hotcached) {
		// 	for (var p in hotcached) {
		// 		if (absurl.indexOf(p) > 0) {
		// 			tasks.push("import");
		// 			break;
		// 		}
		// 	}
		// }

		tasks.push("import");

		if (tasks.length) {
			sequence.apply(null, tasks)
		}
	});

	// # 刷新浏览器
	// # 限制浏览器刷新频率
	watch(paths.dev + "/**/*", function() {
		if (reloadTimer) {
			clearTimeout(reloadTimer);
		}
		reloadTimer = setTimeout(reload, 1000);
	});
});


// #############################################
// # public task

gulp.task("default", function(cb) {
	release = false;
	sequence(
		// 清理目录
		"clean:dev",
		// 生成配置文件及字体图标及图片sprite
		["config:loader", "config:app", "svgsprite"],
		// 编译sass， 拷贝文件
		["sass", "copy"],
		// 导入文件，启动服务器
		"import", "server", cb
	);
});

gulp.task("release", function(cb) {
	release = true;
	sequence(
		// 清理目录
		["clean:dist", "clean:temp"],
		// 生成配置文件及字体图标及图片sprite
		["config:loader", "config:app", "svgsprite"],
		// 编译sass， 拷贝文件到临时目录
		["sass", "copy"],
		// 打包合并资源，导入资源，复制资源，清理临时目录
		"kspack", "import", "copy:dist", "clean:temp", cb
	);
});