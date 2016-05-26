define(function(require, exports, module) {
	// module: io-query
	// summary:
	//      This module defines query/url/form string processing functions.
	var lang = require("./lang");
	var backstop = {};

	return {
		location: function(url) {
			var dm, hs, qu;
			url = url || location.href;
			dm = url.match(/^[^?#]+/i)[0];
			url = url.slice(dm.length);
			if (url.match(/^\?[^#]+/i)) {
				qu = url.match(/^\?[^#]+/i)[0];
				url = url.slice(qu.length);
				if (url.match(/^#[^?]+/i)) {
					hs = url.match(/^#[^?]+/i)[0];
				}
			} else if (url.match(/^#[^?]+/i)) {
				hs = url.match(/^#[^?]+/i)[0];
				url = url.slice(hs.length);
				if (url.match(/^\?[^#]+/i)) {
					qu = url.match(/^\?[^#]+/i)[0];
				}
			}
			url = {
				domain: dm,
				query: (qu || '').slice(1),
				hash: (hs || '').slice(1),
				param: {},
				toString: function() {
					var key, ref, val;
					qu = [];
					ref = this.param;
					for (key in ref) {
						var p = key;
						val = ref[key];
						if (val !== void 0 && val !== null) {
							p += '=' + val;
						}
						qu.push(p);
					}
					if (qu.length) {
						qu = '?' + qu.join("&");
					}
					hs = this.hash ? '#' + this.hash : '';
					return this.domain + qu + hs;
				}
			};
			if (url.query) {
				url.query.replace(/(?:^|&)([^=&]+)(?:=([^&]*))?/gi, function(a, b, d) {
					return url.param[b] = d;
				});
			}
			return url;
		},
		objectToQuery: function objectToQuery(map) {
			var enc = encodeURIComponent, pairs = [];
			for (var name in map) {
				var value = map[name];
				if (value != backstop[name]) {
					var assign = enc(name) + "=";
					if (lang.isArray(value)) {
						for (var i = 0, l = value.length; i < l; ++i) {
							pairs.push(assign + enc(value[i]))
						}
					} else {
						pairs.push(assign + enc(value))
					}
				}
			}
			return pairs.join("&")
    },
    queryToObject: function queryToObject(str) {
			var dec = decodeURIComponent, qp = str.split("&"), ret = {}, name, val;
			for (var i = 0, l = qp.length, item; i < l; ++i) {
				item = qp[i];
				if (item.length) {
					var s = item.indexOf("=");
					if (s < 0) {
						name = dec(item);
						val = ""
					} else {
						name = dec(item.slice(0, s));
						val  = dec(item.slice(s + 1))
					}
					if (typeof ret[name] == "string") {
						ret[name] = [ret[name]]
					}

					if (lang.isArray(ret[name])) {
						ret[name].push(val)
					} else {
						ret[name] = val
					}
				}
			}
			return ret
    },
    fromToObject: function fromToObject(form) {

    }
	}
});