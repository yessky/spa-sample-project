define(function(require) {
	'use strict';
	// author:
	//		aaron.xiao<admin@veryos.com>
	// summary:
	//		A module that provides core event listening/remove functionality

	// borrow from dojo/on
	//	- rewrite some logic
	//	- adjust fixAttach to avoid expose extra global variable

	var has = require('./has');
	var aspect = require('./aspect');
	var dom = require('./dom');

	if (has('dom')) {
		var major = window.ScriptEngineMajorVersion,
			winEvent = window.Event;

		has.add('jscript', major && (major() + ScriptEngineMinorVersion() / 10));
		has.add('event-orientationchange', has('touch') && !has('android'));
		has.add('event-stopimmediatepropagation', winEvent && !! winEvent.prototype && !! winEvent.prototype.stopImmediatePropagation);
		has.add('event-focusin', function(global, doc, element) {
			return 'onfocusin' in element;
		});

		if (has("touch")) {
			has.add("touch-can-modify-event-delegate", function() {
				// This feature test checks whether deleting a property of an event delegate works
				// for a touch-enabled device. If it works, event delegation can be used as fallback
				// for browsers such as Safari in older iOS where deleting properties of the original
				// event does not work.
				var EventDelegate = function() {};
				EventDelegate.prototype = document.createEvent("MouseEvents");
				try {
					var eventDelegate = new EventDelegate;
					eventDelegate.target = null;
					return eventDelegate.target === null
				} catch (e) {
					return false
				}
			})
		}
	}

	var rsplit = /[\x20\t\n\r\f]*,[\x20\t\n\r\f]*/,
		rmixed = /(.*)\[\]/,
		rtouch = /^touch/;

	var captures = has('event-focusin') ? {} : {
		focusin: 'focus',
		focusout: 'blur'
	};

	if (!has('event-stopimmediatepropagation')) {
		var stopImmediatePropagation = function() {
			this.immediatelyStopped = true;
			this.modified = true;
		};
		var addStopImmediate = function(listener) {
			return function(event) {
				if (!event.immediatelyStopped) {
					event.stopImmediatePropagation = stopImmediatePropagation;
					return listener.apply(this, arguments);
				}
			};
		}
	}

	var on = function(target, type, listener) {
		if (typeof target.on === 'function' && typeof type !== 'function' && !target.nodeType) {
			// delegate to the target's on() method
			return target.on(type, listener)
		}
		return on.parse(target, type, listener, addListener, this)
	};

	function syntheticPreventDefault() {
		this.cancelable = false;
		this.defaultPrevented = true
	}

	function syntheticStopPropagation() {
		this.bubbles = false;
	}

	var slice = [].slice;
	var syntheticDispatch = on.emit = function(target, type, event) {
		var args = slice.call(arguments, 2),
			method = 'on' + type;

		if ('parentNode' in target) {
			// node (or node-like), create event controller methods
			var newEvent = args[0] = {};
			for (var i in event) {
				newEvent[i] = event[i];
			}
			newEvent.preventDefault = syntheticPreventDefault;
			newEvent.stopPropagation = syntheticStopPropagation;
			newEvent.target = target;
			newEvent.type = type;
			event = newEvent;
		}

		do {
			// call any node which has a handler (note that ideally we would try/catch to simulate normal event propagation but that causes too much pain for debugging)
			target[method] && target[method].apply(target, args);
			// and then continue up the parent node chain if it is still bubbling (if started as bubbles and stopPropagation hasn't been called)
		} while (event && event.bubbles && (target = target.parentNode));
		// if it is still true (was cancelable and was cancelled), return the event to indicate default action should happen
		return event && event.cancelable && event;
	};

	if (has('dom-addeventlistener')) {
		// emitter that works with native event handling
		on.emit = function(target, type, event) {
			if (target.dispatchEvent && document.createEvent) {
				// use the native event emitting mechanism if it is available on the target object
				var nativeEvent = target.ownerDocument.createEvent('HTMLEvents');
				nativeEvent.initEvent(type, !! event.bubbles, !! event.cancelable);
				// and copy all our properties over
				for (var i in event) {
					if (!(i in nativeEvent)) {
						nativeEvent[i] = event[i];
					}
				}
				return target.dispatchEvent(nativeEvent) && nativeEvent;
			}
			return syntheticDispatch.apply(on, arguments);
		};
	} else {
		// old IE browsers
		on._fixEvent = function(evt, sender) {
			if (!evt) {
				var w = sender && (sender.ownerDocument || sender.document || sender).parentWindow || window;
				evt = w.event;
			}
			if (!evt) {
				return evt;
			}
			try {
				if (lastEvent && evt.type === lastEvent.type && evt.srcElement === lastEvent.target) {
					evt = lastEvent;
				}
			} catch (e) {
				// will occur on IE on lastEvent.type reference if lastEvent points to a previous event that already
				// finished bubbling, but the setTimeout() to clear lastEvent hasn't fired yet
			}
			if (!evt.target) {
				var evtType = evt.type;
				evt.target = evt.srcElement;
				evt.currentTarget = (sender || evt.srcElement);
				if (evtType === 'mouseover') {
					evt.relatedTarget = evt.fromElement;
				}
				if (evtType === 'mouseout') {
					evt.relatedTarget = evt.toElement;
				}
				if (!evt.stopPropagation) {
					evt.stopPropagation = stopPropagation;
					evt.preventDefault = preventDefault;
				}
				switch (evtType) {
				case 'keypress':
					var c = ('charCode' in evt ? evt.charCode : evt.keyCode);
					if (c === 10) {
						// CTRL-ENTER is CTRL-ASCII(10) on IE, but CTRL-ENTER on Mozilla
						c = 0;
						evt.keyCode = 13;
					} else if (c === 13 || c === 27) {
						c = 0; // Mozilla considers ENTER and ESC non-printable
					} else if (c === 3) {
						c = 99; // Mozilla maps CTRL-BREAK to CTRL-c
					}
					// Mozilla sets keyCode to 0 when there is a charCode
					// but that stops the event on IE.
					evt.charCode = c;
					break;
				}
			}
			return evt;
		};
		var lastEvent;
		var _IEListeners_ = [];
		var createEmitter = function() {
			var emitter = Function('event', 'var callee = arguments.callee; for(var i = 0; i<callee.listeners.length; i++){var listener = callee._IEListeners_[callee.listeners[i]]; if(listener){listener.call(this,event);}}');
			emitter._IEListeners_ = _IEListeners_;
			return emitter;
		};
		var IESignal = function(handle) {
			this.handle = handle;
		};
		IESignal.prototype.remove = function() {
			delete _IEListeners_[this.handle];
		};
		var fixListener = function(listener) {
			return function(evt) {
				evt = on._fixEvent(evt, this);
				var result = listener.call(this, evt);
				if (evt.modified) {
					// cache the last event and reuse it if we can
					if (!lastEvent) {
						setTimeout(function() {
							lastEvent = null;
						});
					}
					lastEvent = evt;
				}
				return result;
			};
		};
		var fixAttach = function(target, type, listener) {
			listener = fixListener(listener);
			if (((target.ownerDocument ? target.ownerDocument.parentWindow : target.parentWindow || target.window || window) != top || has('jscript') < 5.8)) {
				// IE will leak memory on certain handlers in frames (IE8 and earlier) and in unattached DOM nodes for JScript 5.7 and below.
				// Here we use global redirection to solve the memory leaks
				var emitter = target[type];
				if (!emitter || !emitter.listeners) {
					var oldListener = emitter;
					emitter = createEmitter();
					emitter.listeners = [];
					target[type] = emitter;
					emitter.global = this;
					if (oldListener) {
						emitter.listeners.push(_IEListeners_.push(oldListener) - 1);
					}
				}
				var handle;
				emitter.listeners.push(handle = (_IEListeners_.push(listener) - 1));
				return new IESignal(handle);
			}

			return aspect.after(target, type, listener, true);
		};

		// Called in Event scope
		var stopPropagation = function() {
			this.cancelBubble = true;
		};
		var preventDefault = on._preventDefault = function() {
			// Setting keyCode to 0 is the only way to prevent certain keypresses (namely
			// ctrl-combinations that correspond to menu accelerator keys).
			// Otoh, it prevents upstream listeners from getting this information
			// Try to split the difference here by clobbering keyCode only for ctrl
			// combinations. If you still need to access the key upstream, bubbledKeyCode is
			// provided as a workaround.
			this.bubbledKeyCode = this.keyCode;
			if (this.ctrlKey) {
				try {
					// squelch errors when keyCode is read-only
					// (e.g. if keyCode is ctrl or shift)
					this.keyCode = 0;
				} catch (e) {}
			}
			this.defaultPrevented = true;
			this.returnValue = false;
			this.modified = true; // mark it as modified  (for defaultPrevented flag) so the event will be cached in IE
		};
	}

	if (has('touch')) {
		var Event = function() {};
		var windowOrientation = window.orientation;
		var fixTouchListener = function(listener) {
			return function(originalEvent) {
				//Event normalization(for ontouchxxx and resize): 
				//1.incorrect e.pageX|pageY in iOS 
				//2.there are no 'e.rotation', 'e.scale' and 'onorientationchange' in Android
				//3.More TBD e.g. force | screenX | screenX | clientX | clientY | radiusX | radiusY

				// see if it has already been corrected
				var event = originalEvent.corrected;
				if (!event) {
					var type = originalEvent.type;
					try {
						delete originalEvent.type; // on some JS engines (android), deleting properties make them mutable
					} catch (e) {}
					if (originalEvent.type) {
						if (has("touch-can-modify-event-delegate")) {
							// If deleting properties of delegated event works, use event delegation:
							EventDelegate.prototype = originalEvent;
							event = new EventDelegate;
						} else {
							// Otherwise last fallback: other browsers, such as mobile Firefox, do not like
							// delegated properties, so we have to copy
							event = {};
							for (var name in originalEvent) {
								event[name] = originalEvent[name];
							}
						}
						// have to delegate methods to make them work
						event.preventDefault = function() {
							originalEvent.preventDefault();
						};
						event.stopPropagation = function() {
							originalEvent.stopPropagation();
						};
					} else {
						// deletion worked, use property as is
						event = originalEvent;
						event.type = type;
					}
					originalEvent.corrected = event;
					if (type === 'resize') {
						if (windowOrientation === window.orientation) {
							//double tap causes an unexpected 'resize' in Android
							return null;
						}
						windowOrientation = window.orientation;
						event.type = 'orientationchange';
						return listener.call(this, event);
					}
					// We use the original event and augment, rather than doing an expensive mixin operation
					if (!('rotation' in event)) { // test to see if it has rotation
						event.rotation = 0;
						event.scale = 1;
					}
					//use event.changedTouches[0].pageX|pageY|screenX|screenY|clientX|clientY|target
					var firstChangeTouch = event.changedTouches[0];
					for (var i in firstChangeTouch) {
						delete event[i]; // delete it first to make it mutable
						event[i] = firstChangeTouch[i];
					}
				}
				return listener.call(this, event);
			};
		};
	}

	// default implemention to add listener to dom elements

	function addListener(target, type, listener, ctx) {
		// event delegation:
		var selector = type.match(/(.*)@(.*)/);
		// if we have a event@selector, the last one is interpreted as an event, and we use event delegation
		if (selector) {
			type = selector[1];
			selector = selector[2];
			// create the extension event for selectors and directly call it
			return on.selector(selector, type).call(ctx, target, listener);
		}
		// test to see if it a touch event right now, so we don't have to do it every time it fires
		if (has('touch')) {
			if (rtouch.test(type)) {
				// fix touch event
				listener = fixTouchListener(listener);
			}
			if (!has('event-orientationchange') && (type === 'orientationchange')) {
				//'orientationchange' not supported <= Android 2.1, 
				//but works through 'resize' on window
				type = 'resize';
				target = window;
				listener = fixTouchListener(listener);
			}
		}

		if (addStopImmediate) {
			listener = addStopImmediate(listener);
		}

		// normal path, the target is 'this'
		if (target.addEventListener) {
			// the target has addEventListener, which should be used if available (might or might not be a node, non-nodes can implement this method as well)
			// check for capture conversions
			var capture = type in captures,
				adjustedType = capture ? captures[type] : type;

			target.addEventListener(adjustedType, listener, capture);
			return {
				remove: function() {
					target.removeEventListener(adjustedType, listener, capture);
				}
			};
		}

		type = 'on' + type;
		if (fixAttach && target.attachEvent) {
			return fixAttach(target, type, listener);
		}

		throw new Error('Target must be an event emitter');
	}

	on.parse = function(target, type, listener, addListener, ctx) {
		if (type.call) {
			// special event handler function
			// on(node, touch.press, touchListener);
			return type.call(ctx, target, listener);
		}

		var events, i, handles, name;

		if (type instanceof Array) {
			events = type;
		} else if (type.indexOf(',') > -1) {
			events = type.split(rsplit);
		}

		if (events && events.length === 1) {
			type = events[0];
			events = false;
		}

		if (events) {
			// register multiple events at once
			handles = [];
			i = 0;
			while (name = events[i++]) {
				handles.push(
				name.call ? name.call(ctx, target, listener) : addListener(target, name, listener, ctx));
			}
			handles.remove = function() {
				for (var i = 0; i < handles.length; i++) {
					handles[i].remove();
				}
			};
			return handles;
		}

		return addListener(target, type, listener, ctx);
	}

	on.once = function(target, type, listener) {
		var signal = on(target, type, function() {
			signal.remove();
			return listener.apply(this, arguments);
		});
		return signal;
	};

	on.pausable = function(target, type, listener) {
		var paused, signal = on(target, type, function() {
			if (!paused) {
				return listener.apply(this, arguments);
			}
		});

		signal.pause = function() {
			paused = true;
		};
		signal.resume = function() {
			paused = false;
		};

		return signal
	};

	on.selector = function(selector, type, children) {
		return function(target, listener) {
			var bubble = type.bubble;
			var match = typeof selector === 'function' ? selector : dom.matchesSelector;

			function select(eventTarget) {
				while (!match(eventTarget, selector, target)) {
					if (eventTarget === target || children === false || !(eventTarget = eventTarget.parentNode) || eventTarget.nodeType !== 1) {
						return;
					}
				}
				return eventTarget;
			}

			if (bubble) {
				return on(target, bubble(select), listener);
			}

			return on(target, type, function(event) {
				var eventTarget = select(event.target);
				if (eventTarget) {
					event.expectedTarget = eventTarget;
					return listener.call(eventTarget, event);
				}
			});
		};
	};

	return on
});