/*
 * builder for Moduler System
 * Copyright (C) 2015 aaron.xiao
 */

var fs = require("fs");
var path = require("path");

// ===========================================
// utils
// ===========================================
var toString = {}.toString;

var slice = [].slice;

function isFunction(it) {
	return toString.call(it) === "[object Function]";
}

function isArray(it) {
	return toString.call(it) === "[object Array]";
}

function isString(it) {
	return toString.call(it) === "[object String]";
}

function isEmpty(it) {
	for (var p in it) {
		return 0;
	}
	return 1;
}

function mix(dest, src) {
	for (var name in src) {
		dest[name] = src[name];
	}
	return dest;
}

function hitch(ctx, fn) {
	return function() {
		if (isString(fn)) {
			fn = ctx[fn];
		}
		return fn && fn.apply(ctx, arguments);
	}
}

function forEach(array, iter) {
	if (array.forEach) {
		array.forEach(iter);
	} else {
		for (var i = 0, l = array.length; i < l; ++i) {
			iter(array[i], i);
		}
	}
}

function makeError(error, info) {
	var descr = {src: "kjs.loader"};
	if (info) { descr.info = info; }
	return mix(new Error(error), descr);
}

function noop() {}

var Evented = {
	signal: function(type, args) {
		var queue = this.events && this.events[type];
		if (queue && (queue = queue.slice(0))) {
			args = isArray(args) ? args : [args];
			for (var i = 0, listener; listener = queue[i]; ++i) {
				listener.apply(null, args);
			}
		}
	},
	on: function(type, listener) {
		var events = this.events || (this.events = {});
		var queue = this.events[type] || (events[type] = []);
		queue.push(listener);
		return {
			remove: function() {
				for (var i = 0; i < queue.length; i++) {
					if (queue[i] === listener) {
						return queue.splice(i, 1);
					}
				}
			}
		};
	}
};

// ===========================================
// loader
// ===========================================
var baseUrl = "./";
var midsMap = {};
var midsMapping = [];
var pathsMapping = [];
var shims = {};
var plugins = {};

// @config - <object>
function configure(config) {
	baseUrl = (config.baseUrl || baseUrl).replace(/\/*$/, "/");
	mix(midsMap, config.map);
	midsMapping = computeMap(midsMap);
	if (config.paths) {
		pathsMapping = computeMap(config.paths);
	}
	mix(shims, config.shim);
	plugins = mix({}, config.plugins);
}

function computeMap(map) {
	var result = [];
	for (var mid in map) {
		var value = map[mid];
		var isSubMap = typeof value === "object";
		var item = [
			mid,
			isSubMap ? computeMap(value) : value,
			new RegExp("^" + mid.replace(/[-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&") + "(?:\/|$)"),
			mid.length,
			mid.split("/").length
		];
		result.push(item);
		if (isSubMap && mid === "*") {
			result.star = item[1];
		}
	}
	result.sort(function (a, b) {
		return a[4] === b[4] ? a[3] - a[3] : a[4] - b[4];
	});
	return result;
}

function execMap(mid, map) {
	if (map) {
		for (var i = 0, l = map.length; i < l; ++i) {
			if (map[i][2].test(mid)) {
				 return map[i];
			}
		}
	}
	return null;
}

function normalizePath(path) {
	var result = [];
	var seg, last;
	path = path.split("/");
	while (path.length) {
		seg = path.shift();
		if (seg === ".." && result.length && last !== "..") {
			result.pop();
			last = result[result.length - 1];
		} else if (seg !== ".") {
			result.push(last = seg);
		}
	}
	return result.join("/");
}

function makeShim(module) {
	var shim = shims[module.mid];
	var exports = shim.exports;
	return {
		deps: shim.deps || [],
		def: isFunction(exports) ? exports :
			isString(exports) ? makeDefine(getObject(exports)) : 
			makeDefine(exports)
	}
}

function makeDefine(exports) {
	return function() {
		return exports;
	}
}

function getObject(expr) {
	var p = expr.split(".");
	var g = window;
	for (var i = 0, l = p.length; i < l; ++i) {
		if (!g[p[i]]) {
			return null;
		}
		g = g[p[i]];
	}
	return g;
}

function scanSource(source) {
	var ret = [];
	var ast = U.parse(source);
	var def = false;
	var async = false;
	var tw = new U.TreeWalker(function(node, decend) {
		if ( node instanceof U.AST_Call ) {
			if ( node.expression.name === 'define' && node.args && !def ) {
				var argsLen = node.args.length;
				def = true;
				// cjs
				if (argsLen === 1) {
					var cjs = ["require", "exports", "module"];
					if (node.args[0].start.type === "keyword" && node.args[0].start.value === "function" && node.args[0].argnames && node.args[0].argnames.length) {
						ret = cjs.slice(0, node.args[0].argnames.length);
					}
				}
				// amd
				else if (argsLen > 1) {
					var i = argsLen === 2 ? 0 : 1;
					if (node.args[i].elements && node.args[i].elements.length ) {
						node.args[i].elements.forEach(function(elem) {
							ret.push( elem.value );
						});
					}
				}
			} else if ( node.expression.name === 'require' && node.args ) {
				if ( node.args[0].start.type === 'string' ) {
					ret.push( node.args[0].value );
				} else {
					async = true;
				}
			}
		}
	});

	ast.walk(tw);

	return {
		deps: ret,
		async: async
	};
}

var hub = mix({}, Evented);

function on(type, listener) {
	return hub.on.call(hub, type, listener);
}

function signal(type, args) {
	return hub.signal.call(hub, type, args);
}

// 模块状态
var REQUESTED = 1;
var LOADED = 2;
var EXECUTING = 4;
var EXECUTED = 5;

// 注册的模块
var modules = {};
var cycles = {};
// @mid - <module id>
// @ref - <referrence module instance>
function makeModuleMap(mid, ref, established) {
	var result;
	if (!established && ref && mid.charAt(0) === ".") {
		mid = ref.mid + "/../" + mid;
	}
	mid = normalizePath(mid);
	if (!(result = modules[mid])) {
		var refMap = ref && execMap(ref.mid, midsMapping);
		var midMap;
		refMap = refMap ? refMap[1] : midsMapping.star;
		if (refMap && (midMap = execMap(mid, refMap))) {
			mid = midMap[1] + mid.slice(midMap[3]);
		}
		if (!(result = modules[mid])) {
			var pathMap = execMap(mid, pathsMapping);
			var url = pathMap ? pathMap[1] + mid.slice(pathMap[3]) : mid;
			if (!(/^(?:\/|\w+:)/.test(url))) {
				url = baseUrl + url;
			}
			if (!(/\.js(?:\?[^?]*)?$/.test(url))) {
				url += ".js";
			}
			result = {
				mid: mid,
				url: path.normalize(url),
				injected: 0,
				executed: 0
			};
		}
	}
	return result;
}

// @mid - <module id>
// @ref - <referrence module instance>
function getModule(mid, ref, established) {
	mid = mid.replace(/\\/g, "/");
	var match = mid.match(/^(.+?)\!(.*)$/);
	var result;
	if (match) {
		var plugin = getModule(match[1], ref, established);
		var req = createRequire(ref);
		var ready = !!plugin.load;
		var prid;
		if (established) {
			prid = match[2];
			mid = plugin.mid + "!" + prid;
		}
		// 运行时的模块id
		else {
			if (ready) {
				prid = resolveResource(plugin, match[2], req);
				mid = plugin.mid + "!" + prid;
			} else {
				prid = match[2];
				mid = plugin.mid + "!*@pm" + uid++;
			}
		}
		result = {
			mid: mid,
			plugin: plugin,
			req: req,
			prid: prid,
			fix: !ready,
			injected: 0,
			executed: 0
		};
	} else {
		result = makeModuleMap(mid, ref, established);
	}
	return modules[result.mid] || (modules[result.mid] = result);
}

function resolve(name, ref) {
	var map = makeModuleMap(name + "/x", ref);
	return {
		mid: map.mid.slice(0, map.mid.length - 2),
		url: map.url.slice(0, map.url.length - 5)
	}
}

function toUrl(name, ref) {
	return resolve(name, ref).url;
}

function resolveResource(plugin, prid, req) {
	return plugin.normalize ? plugin.normalize(prid, req.resolve) : req.resolve(prid);
}

function trimArray( parts ) {
	var start = 0, len = parts.length;
	for ( ; start < len; start++ ) {
		if ( parts[start] !== '' ) break;
	}
	var end = len - 1;
	for ( ; end >= 0; end-- ) {
		if ( parts[end] !== '' ) break;
	}
	if ( start > end ) return [];
	return parts.slice( start, end + 1 );
}

function relative(from, to) {
	to = normalizePath(to);
	var fromParts = trimArray( from.split('/') );
	var toParts = trimArray( to.split('/') );
	var length = Math.min( fromParts.length, toParts.length );
	var samePartsLength = length;
	for (var i = 0; i < length; i++) {
		if (fromParts[i] !== toParts[i]) {
			samePartsLength = i;
			break;
		}
	}
	var outputParts = [];
	for (var i = samePartsLength; i < fromParts.length; i++) {
		outputParts.push( '..' );
	}
	outputParts = outputParts.concat(toParts.slice(samePartsLength));
	return outputParts.join('/');
}

// 内置的cjs模块(require, exports, module)
var cjsmeta = {
	def: true,
	result: true,
	injected: LOADED,
	executed: EXECUTED
};
var cjsRequire = mix(getModule("require"), cjsmeta);
var cjsExports = mix(getModule("exports"), cjsmeta);
var cjsModule = mix(getModule("module"), cjsmeta);

// @deps - <dependencies array>
// @callbak - <anything>
function req(config, deps, callback) {
	// require("mid") or require(["mid"])
	if (isArray(config) || isString(config)) {
		callback = deps;
		deps = config;
		config = null;
	}
	if (config) {
		configure(config);
	}
	return contextRequire(deps, callback);
}

req.on = on;
req.config = configure;
req.injectUrl = injectUrl;
req.onError = function(err) {
	throw err;
}
req.onCycle = function(stack) {
	console.log("circular stack: ", stack);
	cycles[stack.pop()] = true;
};
req.resolve = function(mid, ref) {
	return resolve(mid, ref).mid;
};
req.toUrl = toUrl;
req.relative = function(path) {
	return relative(baseUrl, toUrl(path));
};
req.context = function(mid) {
	return createRequire(getModule(mid));
};
var trace = req.trace = function(group, details) {
	signal("trace", ["trace:" + group, details]);
};

var error = "error";
var uid = 1;
var execQ = [];
var guarding = 0;

// @deps - <string or array>
// @callback - <anything>
// @ref - <referrence module instalnce>
function contextRequire(deps, callback, ref) {
	var module;
	// 获取模块接口
	if (isString(deps)) {
		module = getModule(deps, ref);
		if (!module.executed) {
			throw makeError("Attempt to require unloaded module " + module.mid);
		}
		module = module.result;
	}
	// 加载模块
	else if (isArray(deps)) {
		module = getModule("*@" + uid++, ref);
		mix(module, {
			clear: 1,
			deps: resolveDeps(deps, module, ref),
			def: callback || noop,
			cb: callback,
			injected: LOADED
		});
		injectDeps(module);
		execQ.push(module);
		checkComplete();
	}
	return module;
}

function idleExec(exec) {
	try {
		guarding++;
		exec();
	} finally {
		guarding--;
	}
}

function checkComplete() {
	if (guarding) { return; }
	idleExec(function() {
		for (var cursum, module, i = 0; i < execQ.length;) {
			module = execQ[i];
			if (module.executed === EXECUTED) {
				execQ.splice(i, 1);
			} else {
				cursum = execsum;
				execModule(module);
				if (cursum !== execsum) {
					i = 0;
				} else {
					i++;
				}
			}
		}
	});
}

var loadsum = 0;
var execsum = 0;
var abortExec = {};
var execTrace = [];

function defineModule(module, source) {
	var mid = module.mid;

	if (module.injected === LOADED) { return }

	var ret = module.plugin ? {deps: []} : scanSource(source);
	var shim = shims[mid];
	var deps = shim ? (shim.deps || []) : ret.deps;
	mix(module, {
		identifier: 1,
		injected: LOADED,
		deps: resolveDeps(deps, module, module),
		rawdeps: deps,
		result: source,
		async: ret.async,
		shim: shim && shimExports(shim.exports)
	});

	module.injected = LOADED;
	injectDeps(module);
}

// @module - <module instalnce>
function execModule(module) {
	// 循环依赖
	if (module.executed === EXECUTING) {
		req.onCycle(execTrace.concat(module.mid));
		return true;
	}
	// 执行模块
	if (!module.executed) {
		if (!module.deps) { return }
		var args = [];
		var deps = module.deps;
		var i = 0;
		var arg;
		execTrace.push(module.mid);
		module.executed = EXECUTING;
		while (arg = deps[i++]) {
			var result = ((arg === cjsRequire) ? createRequire(module) :
				((arg === cjsExports) ? true :
					((arg === cjsModule) ? true :
						execModule(arg))));
			if (!result) {
				module.executed = 0;
				execTrace.pop();
				return false;
			}
			args.push(result);
		}
		if (module.cb) { module.cb.apply(this, args); }
		module.executed = EXECUTED;
		module.execsum = execsum++;
		var plugin = plugins[module.mid];
		if (plugin) {
			module.load = plugin.load;
			module.normalize = plugin.normalize;
			module.copyonly = plugin.copyonly;
		}
		if (module.clear) { delete modules[module.mid] }
		if (module.loadQ) {
			forEach(module.loadQ, function(src) {
				var prid = resolveResource(module, src.prid, src.req);
				var mid = module.mid + "!" + prid;
				var resource;
				if (!(resource = modules[mid])) {
					resource = mix(mix({}, src), {prid: prid, mid: mid});
					injectPlugin(modules[mid] = resource);
				}
				src.fix(resource);
				delete modules[src.mid];
			});
			module.loadQ = undefined;
		}
		execTrace.pop()
	}
	return module.result;
}

// @module - <module instance>
function injectModule(module) {
	if (module.plugin) {
		injectPlugin(module);
	} else if (!module.injected) {
		module.injected = REQUESTED;
		injectUrl(module.url, function(source) {
			defineModule(module, source);
			checkComplete();
		}, module);
	}
}

// @module - <module instance>
function injectPlugin(module) {
	var plugin = module.plugin;
	if (plugin.load) {
		var prid = resolveResource(plugin, module.prid, module.req);
		var mid = plugin.mid + "!" + prid;
		var src = module;
		if (!modules[mid]) {
			modules[mid] = mix(mix({}, src), {prid: prid, mid: mid});
			src.fix(module);
			delete modules[src.mid];
		}
		module = modules[mid];
		if (module.injected) { return }
		module.injected = REQUESTED;
		plugin.load(module.prid, module.req, function(result) {
			defineModule(module, result);
			checkComplete();
		});
	} else if (plugin.loadQ) {
		plugin.loadQ.push(module);
	} else {
		plugin.loadQ = [module];
		execQ.unshift(plugin);
		injectModule(plugin);
	}
}

function injectUrl(url, cb) {
	fs.readFile(url, "utf8", function(err, data) {
		if (err) {
			req.onError(err);
		} else {
			cb(data.toString());
		}
	});
}

function shimExports(result) {
	var factory = 'define(function(){$0\nreturn getObject("$1");});';
	if (isString(result)) {
		return printf(factory, [
			getObject.toString(),
			result
		]);
	} else {
		return printf("define($0)", [
			result.toString()
		]);
	}
}

// @module - <module instalnce>
function createRequire(module) {
	var result = (!module && req) || module.require;
	if (!result) {
		module.require = result = function(mid, callback) {
			return contextRequire(mid, callback, module);
		};
		mix(result, req);
		result.resolve = function(mid) {
			return resolve(mid, module).mid;
		};
		result.toUrl = function(url) {
			return toUrl(url, module);
		};
		result.context = function(mid) {
			return createRequire(getModule(mid, module));
		};
	}
	return result;
}

// @deps - <string or array>
// @module - <module instance>
// @ref - <referrence module instalnce>
function resolveDeps(deps, module, ref) {
	var result = [];
	forEach(deps, function(mid, i) {
		var dep = getModule(mid, ref);
		if (dep.fix) {
			dep.fix = function(result) {
				module.deps[i] = result;
			};
		}
		result.push(dep);
	});
	return result;
}

// @module - <module instalnce>
function injectDeps(module) {
	idleExec(function() {
		forEach(module.deps, function(dep) {
			injectModule(dep);
		});
	});
}

// ===========================================
// builder
// ===========================================
var U = require("uglify-js");
var htmlMinifier = require("html-minifier");
var crypto = require('crypto');
var glob = require("glob");

function isCjs(mid) {
	return /^(require|exports|module)$/.test(mid);
}

function url2mid(url, base, keepExt) {
	var mid = path.relative(base, url);
	return keepExt ? mid : mid.replace(/\.js$/, "");
}

function url2rid(url, base, plugins) {
	var mid = url2mid(url, base);
	for (var pid in plugins) {
		var plugin = plugins[pid];
		var matcher = plugin.test;
		if (
			(matcher instanceof RegExp) && matcher.test(mid) ||
			isFunction(matcher) && matcher(mid) ||
			isString(matcher) && matcher === mid
		) {
			return pid + "!" + mid;
		}
	}
	return mid;
}

function resolveHashid(module, hash) {
	// TODO: resolve with extensions ?
	if (module.plugin && !/\.js$/.test(module.prid)) {
		return module.prid.replace(/\.([^\.\/]+)$/, "." + hash + ".$1");
	}
	return module.mid + "." + hash;
}

function Builder(profile) {
	this.profile = mix({modular: {}, log: 0}, profile);
	this.stats = {}
}

mix(Builder.prototype, Evented);

mix(Builder.prototype, {
	constructor: Builder,

	identifier: 1,

	log: function(str) {
		if (this.profile.log) {
			console.log(str)
		}
	},

	timing: function(name) {
		if (!this.stats.timing) {
			this.stats.timing = {}
		}
		this.stats.timing[name] = Date.now()
	},

	build: function() {
		this.log("[KSPACK] Modular build system");

		var profile = this.profile;
		var appBase = profile.appBase;
		var modular = profile.modular;
		var entry = profile.entry;
		var output = profile.output;
		var baseUrl = modular.baseUrl;
		var loader = modular.loader;

		// nofmalize appBase
		profile.appBase = appBase || process.cwd();
		// normalize baseUrl
		if (!/(^\/|^\w+:)/.test(baseUrl)) {
			modular.baseUrl = path.join(profile.appBase, baseUrl)
		}
		// normalize loader url
		if (loader) {
			modular.loader = path.join(modular.baseUrl, loader)
		}

		// if no entry then quit
		if (!entry) { return this.log("exist as no entry !") }

		// start
		this.timing("start");
		this.modules = modules;
		this.cycles = cycles;

		// normalize entry, make entry be a key-value map
		var entries = mix({}, entry);
		if (isString(entry)) { entry = [entry] }
		if (isArray(entry)) {
			var mid = url2mid(entry[0], "./");
			entries[mid] = entry
		}
		profile.entry = entries;

		// prepare entry mids
		var mids = [];
		var midsHash = {};
		for (var i in entries) {
			if (!midsHash[i]) {
				midsHash[i] = true;
				mids.push(i)
			}
		}
		this.entry = mids.slice(0);
		// prepare chunk mids
		var chunk = profile.chunk || [];
		chunk.forEach(function(p) {
			if (p.type != "common" && p.assets && p.assets.length) {
				p.assets.forEach(function(i) {
					if (!midsHash[i]) {
						midsHash[i] = true;
						mids.push(i)
					}
				})
			}
		});
		profile.chunk = chunk;

		// load modules
		req(modular, mids, function() {
			this.timing("assetsLoad");
			this.async(function() {
				setTimeout(function() {
					this.log("[KSPACK] emit chunks ...");
					this.timing("ondemandLoad");
					this.emit();
					this.timing("complete");
					this.log("[KSPACK] complete !!!");
					var stats = mix({}, this.stats);
					stats.output = mix({}, profile.output);
					stats.input = {
						appBase: profile.appBase,
						baseUrl: profile.baseUrl
					};
					this.signal("complete", stats)
				}.bind(this), 100)
			}.bind(this))
		}.bind(this))
	},

	// load any on-demand assets
	async: function(cb) {
		// check if on-demand assets exists
		for (var p in this.modules) {
			if (this.modules[p].async) {
				this._ondemand = true
			}
		}

		var ondemand = this._ondemand;
		var profile = this.profile;
		var amds = profile.async;
		var modular = profile.modular;
		var loader = modular.loader;
		var baseUrl = modular.baseUrl;
		var paths = modular.paths;
		var plugins = modular.plugins || {};

		// normalize on-demand assets glob
		// if any on-demand assets found in entry/entries,
		// we try to analyze all paths in specified extensions recursively
		if (isString(amds)) { amds = [amds] }
		if (ondemand && !amds || !isArray(amds)) { amds = ["**"] }
		if (!isArray(amds) || !amds.length) { return cb() }

		// compute mid from paths
		var alias = {};
		for (var p in paths) {
			var x = makeModuleMap(paths[p]);
			alias[x.url] = p
		}

		// collect files from glob
		var files = {};
		amds.forEach(function(dir) {
			var dirpath = path.join(baseUrl, dir);
			var items = glob.sync(dirpath);
			items.forEach(function(i) {
				if (!files[i]) { files[i] = true }
			});
		}, this);

		// collect mids from files
		var mids = [];
		var ondemandMids = this._ondemandMids = {};
		for (var p in files) {
			if (p !== loader) {
				var mid = alias[p] || url2rid(p, baseUrl, plugins);
				mid = mid.replace(/\\/g, "/");
				if (!ondemandMids[mid]) {
					mids.push(mid);
					ondemandMids[mid] = p
				}
			}
		}
		// add loader as a shim module
		if (loader) {
			var mid = alias[loader] || url2mid(loader, baseUrl);
			mid = mid.replace(/\\/g, "/");
			if (!ondemandMids[mid]) {
				mids.push(mid);
				ondemandMids[mid] = loader
			}
		}

		// start load on-demand modules
		mids.length ? req(mids, cb) : cb()
	},

	// 1. compute module's priority
	// 2. collect dependencies
	// 3. compute common/concat chunk modules
	// 4. create chunks
	// 5. make map for AMD loader
	emit: function() {
		var profile = this.profile;
		var modules = this.modules;
		var cycles = this.cycles;
		var entries = resolveDeps(this.entry);
		var chunkMap = {};
		var chunks = this._chunks = [];

		function walk(identifier, mods) {
			mods.forEach(function(module) {
				var mid = module.mid;
				var cur = module.identifier || -999;
				if (!isCjs(mid) && (!cycles[mid] || cur === -999)) {
					module.identifier = Math.max(cur, identifier + 1);
					walk(module.identifier, module.deps || [])
				}
			})
		}

		function collect(module) {
			var deps = module.deps || [];
			var result = {};
			deps.forEach(function(module) {
				var mid = module.mid;
				var plugin = module.plugin;
				if (!result[mid] && !isCjs(mid)) {
					result[mid] = true;
					mix(result, collect(module));
					if (plugin) {
						result[plugin.mid] = true;
						mix(result, collect(plugin))
					}
				}
			});
			if (module.mid) {
				result[module.mid] = true
			}
			return result
		}

		function commonlize(mids) {
			// start from module that has less dependencies
			var mods = mids.map(function(i) {
				var map = chunkMap[i] || {};
				var assets = Object.keys(map);
				return {name: i, map: map, assets: assets, count: assets.length}
			});
			mods.sort(function(a, b) {
				return a.count - b.count
			});
			var result = {};
			var base = mods.shift();
			base.assets.forEach(function(i) {
				var common = mods.every(function(m) {
					return m.map.hasOwnProperty(i)
				});
				if (common) {
					result[i] = true
				}
			});
			return result
		}

		// compute module priority
		walk(0, entries);
		// collect entry's dependencies
		entries.forEach(function(module) {
			chunkMap[module.mid] = collect(module)
		});
		// collect chunk's dependencies
		profile.chunk.forEach(function(it) {
			var chunk = {name: it.name};
			if (it.type == "concat") {
				var deps = (it.assets || []).map(function(i) {
					return modules[i]
				});
				if (it.children) {
					chunk.assets = collect({deps: deps})
				} else {
					var result = {};
					deps.forEach(function(i) {
						result[i.mid] = true
						if (i.plugin) {
							result[i.plugin.mid] = true
						}
					});
					chunk.assets = result
				}
				chunks.push(chunk)
			} else if (it.type == "common") {
				chunk.assets = commonlize(it.asset || this.entry);
				chunks.push(chunk)
			} else {
				// todo
			}
		}, this);
		// add entry to chunks
		entries.forEach(function(it) {
			var name = it.mid;
			chunks.push({name: name, assets: chunkMap[name]})
		});

		// filter chunk's assets
		var stats = this.stats;
		var amdmap = stats.map = {};
		var manifest = stats.manifest = {};
		var output = profile.output;
		var chunkAsset = stats.chunks || {};
		var orphans = this._orphans = [];
		var emited = this._emited = {};
		var packages = this._packages = {};

		chunks.forEach(function(it) {
			var name = it.name;
			var map = it.assets;
			if (emited.hasOwnProperty(name)) { return }
			packages[name] = Object.keys(map).filter(function(i) {
				if (!emited.hasOwnProperty(i)) {
					var module = modules[i];
					if (!module.plugin || !module.plugin.copyonly) {
						emited[i] = true;
						return true
					}
				}
			})
		}, this);

		// filter on-demand chunk's assets
		var ondemandChunks = this._ondemandChunks = [];
		for (var mid in modules) {
			var module = modules[mid];
			if (!isCjs(mid) && !emited.hasOwnProperty(mid) && !module.plugin) {
				var assets = collect(module);
				var assetsList = Object.keys(assets);
				// TDDO: remove it
				walk(module.identifier, resolveDeps(assetsList));
				ondemandChunks.push({name: mid, assets: assets, count: assetsList.length})
			}
		}
		// minimize chunks
		ondemandChunks.sort(function(a, b) {
			return b.count - a.count
		});
		ondemandChunks.forEach(function(it) {
			var name = it.name;
			var map = it.assets;
			if (emited.hasOwnProperty(name)) { return }
			packages[name] = Object.keys(map).filter(function(i) {
				if (!emited.hasOwnProperty(i)) {
					var module = modules[i];
					if (!module.plugin || !module.plugin.copyonly) {
						emited[i] = true;
						return true
					}
				}
			})
		}, this);

		// rest on-demand assets(like images/mp3)
		for (var mid in modules) {
			if (!isCjs(mid) && !emited.hasOwnProperty(mid)) {
				emited[mid] = true;
				orphans.push(mid)
			}
		}

		// 1. emit on-demand assets
		orphans.forEach(function(i) {
			var chunk = chunkAsset[i] = this.makeAsset(modules[i]);
			manifest[fixBackslash(chunk.url)] = fixBackslash(chunk.hashurl);
			amdmap[fixBackslash(chunk.prid || chunk.mid)] = fixBackslash(chunk.hashmid)
		}, this);

		// 2. emit chunks
		for (var name in packages) {
			var chunk = chunkAsset[name] = this.makeChunk(name, packages[name]);
			manifest[fixBackslash(chunk.url)] = fixBackslash(chunkAsset[name].hashurl);
			var hashmid = fixBackslash(chunk.hashmid);
			packages[name].forEach(function(i) {
				var module = modules[i];
				amdmap[fixBackslash(module.prid || module.mid)] = hashmid
			})
		}

		// 3. make amd loader map
		var outUrl = output.path;
		var count = 0;
		for (var p in chunkAsset) {
			var chunk = chunkAsset[p];
			var dist = path.join(outUrl, chunk.hashurl);
			count++;
			this.log("[KSPACK] emited: " + chunk.hashmid);
			if (chunk.copyonly) {
				writeSync(dist, fs.readFileSync(chunk.path))
			} else {
				writeSync(dist, chunk.source)
			}
		}
		this.log("[KSPACK] " + count + " chunks emited.")
	},

	// transform cjs to amd format, inline templates, etc.
	compile: function(module, skipCompile) {
		var profile = this.profile;
		var modular = profile.modular;
		var output = profile.output;
		var plugins = modular.plugins || {};
		var mid = module.mid;
		var match = mid.match(/(.*)!(.*)/);
		var url = module.url || module.prid;
		var compile;

		// use plugin compiler if exists
		if (match) {
			for (var i = 0, compiler; compiler = compilers[i]; ++i) {
				if (url.match(compiler.test)) {
					compile = compiler.compile;
					break
				}
			}
		}
		compile = compile || compileAmd;

		return compile({
			mid: module.mid,
			deps: module.deps.slice(0),
			rawdeps: module.rawdeps.slice(0),
			url: url,
			result: module.result,
			shim: module.shim
		}, skipCompile, output.compress, function(url) {
			var parts = url.split(".");
			var ext = parts.pop();
			return url || parts.join(".") + ".resolved." + ext
		})
	},

	// package assets into named chunk
	makeChunk: function(name, assets) {
		var profile = this.profile;
		var modular = profile.modular;
		var baseUrl = modular.baseUrl;
		var chunk = getModule(name);
		var url = url2mid(chunk.url, baseUrl, true);
		var source = "";
		var identifier = 1;
		var hash, filehash;

		assets.map(function(mid) {
			return modules[mid]
		}).sort(function(a, b) {
			return b.identifier > a.identifier ? 1 : -1
		}).forEach(function(module) {
			source += (source ? "\n" : "") + this.compile(module);
			identifier = Math.max(identifier, module.identifier)
		}, this);

		hash = checksum(source);
		filehash = this.makeHash(url, hash);

		return {
			mid: name,
			hashmid: name + "." + filehash.hash,
			identifier: identifier,
			url: url,
			hashurl: filehash.url,
			path: chunk.url,
			source: source,
			size: source.length,
			hash: hash,
			shorthash: filehash.hash,
			assets: assets
		}
	},

	// make asset with computed hash
	makeAsset: function(module) {
		var copyonly = module.plugin && module.plugin.copyonly;
		var prid = module.plugin ? toUrl(module.prid) : module.url;
		var url = url2mid(prid, baseUrl, true);
		var localPath = module.url || (copyonly ? module.result : module.prid);
		var source = copyonly ? fs.readFileSync(localPath, "utf8") + "" : this.compile(module, true);
		var hash = checksum(source);
		var filehash = this.makeHash(url, hash);

		return {
			mid: module.mid,
			prid: module.prid,
			hashmid: (!module.prid || !/\.(\w+)$/.test(module.prid)) ?
				(module.prid || module.mid) + "." + filehash.hash :
				module.prid.replace(/\.(\w+)$/, "." + filehash.hash + ".$1"),
			identifier: module.identifier,
			url: url,
			hashurl: filehash.url,
			path: localPath,
			source: source,
			size: source.length,
			hash: hash,
			shorthash: filehash.hash,
			assets: [module.mid],
			copyonly: !!copyonly
		}
	},

	// compute hash-url
	makeHash: function(url, hash) {
		var profile = this.profile;
		var filename = profile.output.filename;

		var parsed = path.parse(url);
		var name = parsed.name;
		var shorthash = hash;
		
		function rename(name, obj) {
			var match = name.match(/(.*):(.*)/);
			name = obj[name];
			if (match) {
				name = obj[match[1]].substring(0, +match[2]);
				if (match[1] === "hash") { shorthash = name }
			}
			return name
		}

		if (filename) {
			parsed.hash = hash;
			name = filename.replace(/\[([^\]]+)\]/g, function(a, b) {
				return rename(b, parsed)
			})
		}

		return {
			url: path.join(parsed.root, parsed.dir, name),
			hash: shorthash
		}
	}
});

// ===========================================
// built-in compilers
// ===========================================
var compilers = [
	// template compiler
	{
		test: /\.(html|tpl)$/,
		compile: function(module, noCompile, compress, stats) {
			// todo: resolve img/background-image url
			var source = module.result;
			if (noCompile) { return source }
			// note: html-minifier is buggy, will uncomment future
			//if (compress) { source = minifyhtml(source) }
			return printf('define("$0",[],$1);', [
				module.mid,
				JSON.stringify(source.replace(/>([\n\t]*)</g, "><"))
			])
		}
	},
	// css compiler
	{
		test: /\.css$/,
		compile: function(module, noCompile, compress, stats) {
			// todo: resolve background-image url
			return module.result
		}
	},
	// plain text compiler
	{
		test: /\.txt$/,
		compile: function(module, noCompile, compress, stats) {
			return module.result
		}
	}
];

function compileAmd(module, noCompile, compress) {
	var result;
	var source = noCompile ? module.result : (module.shim || module.result);
	var parsed = parseSource(source);

	if (noCompile || (!parsed.isAmd && !module.shim)) {
		result = module.result;
	} else {
		var deps = module.deps.map(function(dep) {
			return dep.mid;
		});
		result = printf('$0define("$1",$2,$3)$4', [
			parsed.left || "",
			module.mid,
			JSON.stringify(module.rawdeps),
			parsed[2] || source,
			paddingSemicolon(parsed.right)
		]);
		if (module.shim) {
			result = module.result  + "\n" + result;
		}
	}
	return compress ? minifyjs(result, null, module.mid, module.url) : result
}

// ===========================================
// builder's helpers
// ===========================================
function parseSource(code) {
	var ret = ['', '', ''];
	var ast = U.parse(code);
	var done = 0;
	var sep = function(node) {
		return code.substring(node.start.pos, node.end.endpos);
	};
	var tw = new U.TreeWalker(function(node, decend) {
		if ( !done && node instanceof U.AST_Call && node.expression.name === 'define' ) {
			var argsLen = node.args.length;
			done = 1;
			if (argsLen === 1) {
				ret[2] = sep(node.args[0]);
			} else if (argsLen === 2) {
				ret[2] = sep(node.args[1]);
				ret[1] = sep(node.args[0]);
			} else if (argsLen >= 3) {
				ret[0] = sep(node.args[0]);
				ret[1] = sep(node.args[1]);
				ret[2] = sep(node.args[2]);
			}

			ret.left = code.substring(0, node.start.pos);
			ret.right = code.substring(node.end.endpos);
			return done;
		}
	});

	ast.walk(tw);
	ret.isAmd = !!done;

	return ret;
}

function paddingSemicolon(str) {
	str = str || ";";
	if (!/;\s*$/.test(str)) {
		str += ";";
	}
	return str;
}

function printf(str, obj) {
	return str.replace(/\$(\d+)/g, function(a, b) {
		return obj[b];
	});
}

function fixBackslash(url) {
	return url.replace(/\\/g, "/")
}

function mkdirSync(dir, mode) {
	if (fs.existsSync(dir)) { return; }

	if (!mode) {
		mode = parseInt('0777', 8) & (~process.umask());
	}

	dir.split(path.sep).reduce(function(parts, part) {
		parts += part + '/';
		var sub = path.resolve(parts);
		if (!fs.existsSync(sub)) {
			fs.mkdirSync(sub, mode);
		}
		return parts;
	}, '');
}

var uglify_mangle = {
	except: ["require", "exports", "module", "$", "_"]
};

function minifyjs(sjs, opts, mid, url) {
	var options = opts || {};
	mix(options, {fromString: true});
	options.output = options.output || {};
	mix(options.output, {ascii_only: true});
	options.mangle = options.mangle || {};
	mix(options.mangle, uglify_mangle);
	var result = U.minify(sjs, options);
	return result.code;
}

function minifyhtml(shtml, opts) {
	return htmlMinifier.minify(shtml, opts || {
		removeComments: true,
		collapseWhitespace: true
	})
}

function writeSync(filename, data) {
	var dir = path.dirname(filename);
	mkdirSync(dir);
	fs.writeFileSync(filename, data, {encoding: 'utf8'});
}

function checksum(str) {
	var sum = crypto.createHash("md5");
	sum.update(str);
	return sum.digest("hex");
}

// ===========================================
// API
// ===========================================
Builder.minifyjs = minifyjs;
Builder.minifyhtml = minifyhtml;
Builder.checksum = checksum;
module.exports = Builder;