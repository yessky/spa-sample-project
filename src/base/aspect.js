define(function(require, exports, module) {
	'use strict';
	// module
	//		base/aspect
	// summary
	//		An implemention of aspect oriented programming.

	var nextId = 1, undefined;

	function advise( dispatcher, type, advice, receiveArgs ) {
		var previous = dispatcher[type],
			around = type === 'around', signal;

		if ( around ) {
			var advised = advice(function() {
				return previous && previous.advice(this, arguments);
			});

			signal = {
				remove: function() {
					if ( advised ) {
						advised = dispatcher = advice = null
					}
				},
				advice: function( target, args ) {
					return advised ?
						advised.apply(target, args) :
						previous.advice(target, args)
				}
			};
		} else {
			signal = {
				remove: function() {
					if ( signal.advice ) {
						var previous = signal.previous,
							next = signal.next;

						if ( !next && !previous ) {
							delete dispatcher[type]
						} else {
							if ( previous ) {
								previous.next = next
							} else {
								dispatcher[type] = next
							}
							if ( next ) {
								next.previous = previous
							}
						}

						// signal that this signal has been removed
						dispatcher = advice = signal.advice = null;
					}
				},
				id: nextId++,
				advice: advice,
				receiveArgs: receiveArgs
			};
		}
		if ( previous && !around ) {
			if ( type === 'after' ) {
				// add the listener to the end of the list
				while ( previous.next && (previous = previous.next) ) {}
				previous.next = signal;
				signal.previous = previous
			} else if ( type === 'before' ) {
				// add to beginning
				dispatcher[type] = signal;
				signal.next = previous;
				previous.previous = signal
			}
		} else {
			// around or first one just replaces
			dispatcher[type] = signal
		}

		return signal
	}

	function aspect( type ) {
		return function( target, methodName, advice, receiveArgs ) {
			var method = target[methodName], dispatcher;

			if ( !method || !method.__dispatchid ) {
				// no dispatcher in place
				target[methodName] = dispatcher = function() {
					var executionId = nextId;
					var args = arguments;

					// before advice
					var before = dispatcher.before;
					while ( before ) {
						args = before.advice.apply(this, args) || args;
						before = before.next
					}

					// around advice
					if ( dispatcher.around ) {
						// use original 'arguments' instead of modified 'args'
						var results = dispatcher.around.advice(this, arguments)
					}

					// after advice
					var after = dispatcher.after;
					while ( after && after.id < executionId ) {
						if ( after.receiveArgs ) {
							var newResults = after.advice.apply(this, args);
							results = newResults === undefined ? results : newResults
						} else {
							results = after.advice.call(this, results, args)
						}
						after = after.next
					}

					return results
				};

				if ( method ) {
					dispatcher.around = {
						advice: function ( target, args ) {
							return method.apply(target, args)
						}
					}
				}

				dispatcher.__dispatchid = nextId
			}

			var signal = advise((dispatcher || method), type, advice, receiveArgs);
			advice = null;
			return signal
		};
	}

	return {
		before: aspect('before'),
		after: aspect('after'),
		around: aspect('around')
	}
});