define(function(require, exports, module) {
	// author:
	//		aaron.xiao<admin@veryos.com>
	// summary:
	// 		touch and mouse synthetic events
	// 		borrowe from dojo/touch

	var lang = require("./lang");
	var has = require("./has");
	var on = require("./on");
	var dom = require("./dom");
	var mouse = require("./mouse");

	var domReady = require.ready;
	var ios4 = has("ios") < 5;
	var win = window;
	var doc = document;
	var body = function() {
		return doc.body || doc.getElementsByTagName("body")[0];
	};

	// Detect if platform supports Pointer Events, and if so, the names of the events (pointerdown vs. MSPointerDown).
	var hasPointer = has("pointer-events") || has("MSPointer"),
		pointer = (function () {
			var pointer = {};
			for (var type in { down: 1, move: 1, up: 1, cancel: 1, over: 1, out: 1 }) {
				pointer[type] = has("MSPointer") ?
					"MSPointer" + type.charAt(0).toUpperCase() + type.slice(1) :
					"pointer" + type;
			}
			return pointer;
		})();

	// Detect if platform supports the webkit touchstart/touchend/... events
	var hasTouch = has("touch-events");

	// Click generation variables
	var clicksInited, clickTracker, useTarget = false, clickTarget, clickX, clickY, clickDx, clickDy, clickTime;

	// Time of most recent touchstart, touchmove, or touchend event
	var lastTouch;

	function dualEvent(mouseType, touchType, pointerType) {
		// Returns synthetic event that listens for both the specified mouse event and specified touch event.
		// But ignore fake mouse events that were generated due to the user touching the screen.
		if (hasPointer && pointerType) {
			// IE10+: MSPointer* events are designed to handle both mouse and touch in a uniform way,
			// so just use that regardless of hasTouch.
			return function(node, listener){
				return on(node, pointerType, listener);
			}
		} else if (hasTouch) {
			return function(node, listener) {
				var handle1 = on(node, touchType, function(evt) {
						listener.call(this, evt);

						// On slow mobile browsers (see https://bugs.dojotoolkit.org/ticket/17634),
						// a handler for a touch event may take >1s to run.  That time shouldn't
						// be included in the calculation for lastTouch.
						lastTouch = (new Date()).getTime();
					}),
					handle2 = on(node, mouseType, function(evt) {
						if (!lastTouch || (new Date()).getTime() > lastTouch + 1000) {
							listener.call(this, evt);
						}
					});
				return {
					remove: function() {
						handle1.remove();
						handle2.remove();
					}
				};
			};
		} else {
			// Avoid creating listeners for touch events on performance sensitive older browsers like IE6
			return function(node, listener) {
				return on(node, mouseType, listener);
			}
		}
	}

	function marked(/*DOMNode*/ node) {
		// Search for node ancestor has been marked with the dojoClick property to indicate special processing.
		// Returns marked ancestor.
		do {
			if (node.dojoClick !== undefined) { return node; }
		} while(node = node.parentNode);
	}

	function doClicks(e, moveType, endType) {
		// summary:
		//		Setup touch listeners to generate synthetic clicks immediately (rather than waiting for the browser
		//		to generate clicks after the double-tap delay) and consistently (regardless of whether event.preventDefault()
		//		was called in an event listener. Synthetic clicks are generated only if a node or one of its ancestors has
		//		its dojoClick property set to truthy. If a node receives synthetic clicks because one of its ancestors has its
		//      dojoClick property set to truthy, you can disable synthetic clicks on this node by setting its own dojoClick property
		//      to falsy.

		var markedNode = marked(e.target);
		clickTracker  = !e.target.disabled && markedNode && markedNode.dojoClick; // click threshold = true, number, x/y object, or "useTarget"
		if (clickTracker) {
			useTarget = (clickTracker == "useTarget");
			clickTarget = (useTarget? markedNode : e.target);
			if (useTarget) {
				// We expect a click, so prevent any other 
				// default action on "touchpress"
				e.preventDefault();
			}
			clickX = e.changedTouches ? e.changedTouches[0].pageX - win.pageXOffset : e.clientX;
			clickY = e.changedTouches ? e.changedTouches[0].pageY - win.pageYOffset : e.clientY;
			clickDx = (typeof clickTracker == "object" ? clickTracker.x : (typeof clickTracker == "number" ? clickTracker : 0)) || 4;
			clickDy = (typeof clickTracker == "object" ? clickTracker.y : (typeof clickTracker == "number" ? clickTracker : 0)) || 4;

			// add move/end handlers only the first time a node with dojoClick is seen,
			// so we don't add too much overhead when dojoClick is never set.
			if (!clicksInited) {
				clicksInited = true;

				function updateClickTracker(e) {
					if (useTarget) {
						clickTracker = dom.isDescendant(
							doc.elementFromPoint(
								(e.changedTouches ? e.changedTouches[0].pageX - win.pageXOffset : e.clientX),
								(e.changedTouches ? e.changedTouches[0].pageY - win.pageYOffset : e.clientY)),
							clickTarget);
					} else {
						clickTracker = clickTracker &&
							(e.changedTouches ? e.changedTouches[0].target : e.target) == clickTarget &&
							Math.abs((e.changedTouches ? e.changedTouches[0].pageX - win.pageXOffset : e.clientX) - clickX) <= clickDx &&
							Math.abs((e.changedTouches ? e.changedTouches[0].pageY - win.pageYOffset : e.clientY) - clickY) <= clickDy;
					}
				}

				doc.addEventListener(moveType, function(e) {
					updateClickTracker(e);
					if (useTarget) {
						// prevent native scroll event and ensure touchend is
						// fire after touch moves between press and release.
						e.preventDefault();
					}
				}, true);

				doc.addEventListener(endType, function(e) {
					updateClickTracker(e);
					if (clickTracker) {
						clickTime = (new Date()).getTime();
						var target = (useTarget?clickTarget:e.target);
						if (target.tagName === "LABEL") {
							// when clicking on a label, forward click to its associated input if any
							target = dom.byId("#" + target.getAttribute("for")) || target;
						}
						//some attributes can be on the Touch object, not on the Event:
						//http://www.w3.org/TR/touch-events/#touch-interface
						var src = (e.changedTouches) ? e.changedTouches[0] : e;
						//create the synthetic event.
						//http://www.w3.org/TR/DOM-Level-3-Events/#widl-MouseEvent-initMouseEvent
						var clickEvt = document.createEvent("MouseEvents");
						clickEvt._dojo_click = true;
						clickEvt.initMouseEvent("click",
							true, //bubbles
							true, //cancelable
							e.view,
							e.detail,
							src.screenX,
							src.screenY,
							src.clientX,
							src.clientY,
							e.ctrlKey,
							e.altKey,
							e.shiftKey,
							e.metaKey,
							0, //button
							null //related target
						);
						setTimeout(function() {
							on.emit(target, "click", clickEvt);

							// refresh clickTime in case app-defined click handler took a long time to run
							clickTime = (new Date()).getTime();
						}, 0);
					}
				}, true);

				function stopNativeEvents(type) {
					doc.addEventListener(type, function(e) {
						// Stop native events when we emitted our own click event.  Note that the native click may occur
						// on a different node than the synthetic click event was generated on.  For example,
						// click on a menu item, causing the menu to disappear, and then (~300ms later) the browser
						// sends a click event to the node that was *underneath* the menu.  So stop all native events
						// sent shortly after ours, similar to what is done in dualEvent.
						if (!e._dojo_click && (new Date()).getTime() <= clickTime + 1000) {
							e.stopPropagation();
							e.stopImmediatePropagation && e.stopImmediatePropagation();
							if (type == "click" && (e.target.tagName != "INPUT" || e.target.type == "radio" || e.target.type == "checkbox")
								&& e.target.tagName != "TEXTAREA" && e.target.tagName != "AUDIO" && e.target.tagName != "VIDEO") {
								 // preventDefault() breaks textual <input>s on android, keyboard doesn't popup,
								 // but it is still needed for checkboxes and radio buttons, otherwise in some cases
								 // the checked state becomes inconsistent with the widget's state
								e.preventDefault();
							}
						}
					}, true);
				}

				stopNativeEvents("click");

				// We also stop mousedown/up since these would be sent well after with our "fast" click (300ms),
				// which can confuse some dijit widgets.
				stopNativeEvents("mousedown");
				stopNativeEvents("mouseup");
			}
		}
	}

	var hoveredNode;

	if (hasPointer) {
		 // MSPointer (IE10+) already has support for over and out, so we just need to init click support
		domReady(function() {
			doc.addEventListener(pointer.down, function(evt) {
				doClicks(evt, pointer.move, pointer.up);
			}, true);
		});
	}else if(hasTouch){
		domReady(function() {
			// Keep track of currently hovered node
			hoveredNode = body();	// currently hovered node

			doc.addEventListener("touchstart", function(evt) {
				lastTouch = (new Date()).getTime();

				// Precede touchstart event with touch.over event.  DnD depends on this.
				// Use addEventListener(cb, true) to run cb before any touchstart handlers on node run,
				// and to ensure this code runs even if the listener on the node does event.stop().
				var oldNode = hoveredNode;
				hoveredNode = evt.target;
				on.emit(oldNode, "dojotouchout", {
					relatedTarget: hoveredNode,
					bubbles: true
				});
				on.emit(hoveredNode, "dojotouchover", {
					relatedTarget: oldNode,
					bubbles: true
				});

				doClicks(evt, "touchmove", "touchend"); // init click generation
			}, true);

			function copyEventProps(evt) {
				// Make copy of event object and also set bubbles:true.  Used when calling on.emit().
				var props = lang.delegate(evt, {
					bubbles: true
				});

				if (has("ios") >= 6) {
					// On iOS6 "touches" became a non-enumerable property, which
					// is not hit by for...in.  Ditto for the other properties below.
					props.touches = evt.touches;
					props.altKey = evt.altKey;
					props.changedTouches = evt.changedTouches;
					props.ctrlKey = evt.ctrlKey;
					props.metaKey = evt.metaKey;
					props.shiftKey = evt.shiftKey;
					props.targetTouches = evt.targetTouches;
				}

				return props;
			}

			on(doc, "touchmove", function(evt) {
				lastTouch = (new Date()).getTime();

				var newNode = doc.elementFromPoint(
					evt.pageX - (ios4 ? 0 : win.pageXOffset), // iOS 4 expects page coords
					evt.pageY - (ios4 ? 0 : win.pageYOffset)
				);

				if (newNode) {
					// Fire synthetic touchover and touchout events on nodes since the browser won't do it natively.
					if (hoveredNode !== newNode) {
						// touch out on the old node
						on.emit(hoveredNode, "dojotouchout", {
							relatedTarget: newNode,
							bubbles: true
						});

						// touchover on the new node
						on.emit(newNode, "dojotouchover", {
							relatedTarget: hoveredNode,
							bubbles: true
						});

						hoveredNode = newNode;
					}

					// Unlike a listener on "touchmove", on(node, "dojotouchmove", listener) fires when the finger
					// drags over the specified node, regardless of which node the touch started on.
					if (!on.emit(newNode, "dojotouchmove", copyEventProps(evt))) {
						// emit returns false when synthetic event "dojotouchmove" is cancelled, so we prevent the
						// default behavior of the underlying native event "touchmove".
						evt.preventDefault();
					}
				}
			});

			// Fire a dojotouchend event on the node where the finger was before it was removed from the screen.
			// This is different than the native touchend, which fires on the node where the drag started.
			on(doc, "touchend", function(evt) {
					lastTouch = (new Date()).getTime();
				var node = doc.elementFromPoint(
					evt.pageX - (ios4 ? 0 : win.pageXOffset), // iOS 4 expects page coords
					evt.pageY - (ios4 ? 0 : win.pageYOffset)
				) || body(); // if out of the screen

				on.emit(node, "dojotouchend", copyEventProps(evt));
			});
		});
	}

	// touch.press|move|release|cancel/over/out
	var touch = {
		tap: hasTouch && dom.gesture && dom.gesture.tap ? dom.gesture.tap : "click",
		press: dualEvent("mousedown", "touchstart", pointer.down),
		move: dualEvent("mousemove", "dojotouchmove", pointer.move),
		release: dualEvent("mouseup", "dojotouchend", pointer.up),
		cancel: dualEvent(mouse.leave, "touchcancel", hasPointer ? pointer.cancel : null),
		over: dualEvent("mouseover", "dojotouchover", pointer.over),
		out: dualEvent("mouseout", "dojotouchout", pointer.out),
		enter: mouse._eventHandler(dualEvent("mouseover","dojotouchover", pointer.over)),
		leave: mouse._eventHandler(dualEvent("mouseout", "dojotouchout", pointer.out))
	};

	return touch
});