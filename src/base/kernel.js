define(function(require, exports, module) {
	"use strict";
	// module:
	//		base/kernel
	// summary:
	//		the hub for manage the system.

	var lang = require("./lang");
	var Evented = require("./Evented");

	var global = (function() { return this }).call(this || window);
	var config = lang.mix(global.ksconfig || {}, {
		global: "KS",
		scopeName: "ks",
		parseOnReady: false
	});

	var KS = lang.delegate({
		version: function() {
			return "1.0.0"
		},
		config: config,
		global: global
	}, new Evented);

	if (config.global) {
		global[config.global] = KS
	}

	return KS
});