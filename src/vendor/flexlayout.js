;(function(Flex) {
	var win = window;
	var doc = win.document;
	var rootElem = doc.documentElement;
	var ua = win.navigator.userAgent;
	var isIPhone = ua.match(/iphone/i);
	var isYIXIN = ua.match(/yixin/i);
	var is2345 = ua.match(/Mb2345/i);
	var ishaosou = ua.match(/mso_app/i);
	var isSogou = ua.match(/sogoumobilebrowser/ig);
	var isLiebao = ua.match(/liebaofast/i);
	var isGnbr = ua.match(/GNBR/i);
	var tid;

	function refreshRem() {
		var sw = win.innerWidth || screen.width;
		var sh = win.innerHeight || screen.height;
		var dpr, rem;
		if (window.devicePixelRatio) {
			dpr = window.devicePixelRatio;
		} else {
			dpr = isIPhone ? sw > 818 ? 3 : sw > 480 ? 2 : 1 : 1;
		}
		sw = sw > 818 ? 818 : sw;
		rem = sw / 7.5;
		Flex.rem = rem;
		Flex.dpr = dpr;
		Flex.baseWidth = sw;

		if (isYIXIN || is2345 || ishaosou || isSogou || isLiebao || isGnbr) {
			//YIXIN 和 2345 这里有个刚调用系统浏览器时候的bug，需要一点延迟来获取
			setTimeout(function() {
				sw = win.innerWidth || screen.width;
				sh = win.innerHeight || screen.height;
				sw = sw > 818 ? 818 : sw;
				rem = sw / 7.5;
				Flex.rem = rem;
				Flex.dpr = dpr;
				Flex.baseWidth = sw;
				rootElem.setAttribute("data-dpr", dpr);
				rootElem.style.fontSize = rem + "px";
				doc.getElementById("fixed-guard").style.display = "none";
			}, 500);
		} else {
			rootElem.setAttribute("data-dpr", dpr);
			rootElem.style.fontSize = rem + "px";
			doc.getElementById("fixed-guard").style.display = "none";
		}
	}

	win.addEventListener("resize", function() {
		tid && clearTimeout(tid);
		tid = setTimeout(refreshRem, 300);
  }, false);
  win.addEventListener("pageshow", function(e) {
		if (e.persisted) {
			tid && clearTimeout(tid);
			tid = setTimeout(refreshRem, 300)
		}
  }, false);

	if (doc.readyState === "complete") {
  	doc.body.style.fontSize = 12 * Flex.dpr + "px"
  } else {
		doc.addEventListener("DOMContentLoaded", function(e) {
			doc.body.style.fontSize = 12 * Flex.dpr + "px"
		}, false)
  }

	Flex.rem2px = function(d) {
		var val = parseFloat(d) * Flex.rem;
		if (typeof d === "string" && d.match(/rem$/)) {
			val += "px";
		}
		return val;
	};
	Flex.px2rem = function(d) {
		var val = parseFloat(d) / Flex.rem;
		if (typeof d === "string" && d.match(/px$/)) {
			val += "rem";
		}
		return val;
	};

	refreshRem();
})(window.Flex = {});