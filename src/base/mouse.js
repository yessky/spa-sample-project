define(function(require, exports, module) {
	// summary:
	// 		mouse event fix

	var on = require('./on');
	var has = require('./sniff');
	var dom = require("./dom");

	var isDescendant = dom.isDescendant;
	var win = window;
	var doc = document;

  has.add('dom-quirks', doc && doc.compatMode == 'BackCompat');
	has.add('events-mouseenter', doc && 'onmouseenter' in doc.createElement('div'));
	has.add('events-mousewheel', doc && 'onmousewheel' in doc);


	var mouseButtons;
	if ( (has('dom-quirks') && has('ie')) || !has('dom-addeventlistener') ) {
		mouseButtons = {
			LEFT:   1,
			MIDDLE: 4,
			RIGHT:  2,
			// helper functions
			isButton: function( e, button ) { return e.button & button; },
			isLeft:   function(e) { return e.button & 1; },
			isMiddle: function(e) { return e.button & 4; },
			isRight:  function(e) { return e.button & 2; }
		};
	} else {
		mouseButtons = {
			LEFT:   0,
			MIDDLE: 1,
			RIGHT:  2,
			isButton: function( e, button ) { return e.button == button; },
			isLeft:   function(e) { return e.button == 0; },
			isMiddle: function(e) { return e.button == 1; },
			isRight:  function(e) { return e.button == 2; }
		};
	}

	function eventHandler( type, selectHandler ) {
		// emulation of mouseenter/leave with mouseover/out using descendant checking
		var handler = function( node, listener ) {
			return on(node, type, function(evt) {
				if ( selectHandler ) {
					return selectHandler( evt, listener );
				}
				if ( !isDescendant(evt.relatedTarget, node) ) {
					evt.matchedTarget = this;
					return listener.call( this, evt );
				}
			});
		};
		handler.bubble = function( select ) {
			return eventHandler(type, function( evt, listener ) {
				var target = select( evt.target );
				var relatedTarget = evt.relatedTarget;
				if ( target && (target !== (relatedTarget && relatedTarget.nodeType === 1 && select(relatedTarget))) ) {
					evt.matchedTarget = target;
					return listener.call( target, evt );
				} 
			});
		};
		return handler;
	}
	var wheel;
	if ( has('events-mousewheel') ) {
		wheel = 'mousewheel';
	} else {
		wheel = function( node, listener ) {
			return on(node, 'DOMMouseScroll', function( evt ) {
				evt.wheelDelta = -evt.detail;
				listener.call( this, evt );
			});
		};
	}

	module.exports = {
		_eventHandler: eventHandler,

		enter: eventHandler('mouseover'),

		leave: eventHandler('mouseout'),

		wheel: wheel,

		isLeft: mouseButtons.isLeft,

		isMiddle: mouseButtons.isMiddle,

		isRight: mouseButtons.isRight
	};
});