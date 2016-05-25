define(function(require, exports, module) {
	// module:
	//		Promise
	// summary:
	//		Promise base(abstract) class. All promises will be instances of this class.

	var lang = require("./lang");

	function Promise() {}

	function throwAbstract() {
		throw new Error( 'abstract' );
	}

	function extend( dest, source ) {
		var pt = dest.prototype;
		for ( var p in source ) {
			pt[p] = source[p];
		}
		return dest;
	}

	extend(Promise, {
		then: function( callback, errback, progback ) {
			throwAbstract();
		},

		cancel: function( reason ) {
			throwAbstract();
		},

		isResolved: function() {
			throwAbstract();
		},

		isRejected: function() {
			throwAbstract();
		},

		isFulfilled: function() {
			throwAbstract();
		},

		isCanceled: function() {
			throwAbstract();
		},

		always: function( callback ) {
			return this.then( callback, callback );
		},

		otherwise: function( errback ) {
			return this.then( null, errback );
		},

		toString: function() {
			return '[object Promise]';
		}
	});

	// module:
	//		Deferred
	// summary:
	//		Deferred base class.

	var PROGRESS = 0,
		RESOLVED = 1,
		REJECTED = 2;

	var FULFILLED_ERROR_MESSAGE = 'This deferred has already been fulfilled.',
		CANCELED_ERROR_MESSAGE = 'The deferred was cancelled.';

	var noop = function() {},
		freezeObject = Object.freeze || noop;

	var signalWaiting = function( waiting, type, result ) {
		for ( var i = 0; i < waiting.length; i++ ) {
			signalListener( waiting[i], type, result );
		}
	};

	var signalListener = function( listener, type, result ) {
		var func = listener[ type ],
			deferred = listener.deferred;

		if ( func ) {
			try {
				var returned = func( result );
				if ( type === PROGRESS ) {
					if ( typeof returned !== 'undefined' ) {
						signalDeferred( deferred, type, returned );
					}
				} else {
					if ( returned && typeof returned.then === 'function' ) {
						listener.cancel = returned.cancel;
						returned.then(
								makeDeferredSignaler( deferred, RESOLVED ),
								makeDeferredSignaler( deferred, REJECTED ),
								makeDeferredSignaler( deferred, PROGRESS ));
						return;
					}
					signalDeferred( deferred, RESOLVED, returned );
				}
			} catch ( e ) {
				signalDeferred( deferred, REJECTED, e );
				if ( console.error ) {
					console.error( e );
				}
			}
		} else {
			signalDeferred( deferred, type, result );
		}
	};

	var makeDeferredSignaler = function( deferred, type ) {
		return function( value ) {
			signalDeferred( deferred, type, value );
		};
	};

	var signalDeferred = function( deferred, type, result ) {
		if ( !deferred.isCanceled() ) {
			switch( type ) {
				case PROGRESS:
					deferred.progress( result );
					break;
				case RESOLVED:
					deferred.resolve( result );
					break;
				case REJECTED:
					deferred.reject( result );
					break;
			}
		}
	};

	var Deferred = function( canceler ) {
		var promise = this.promise = new Promise();
		var fulfilled, result;
		var canceled = false;
		var waiting = [];

		this.isResolved = promise.isResolved = function() {
			return fulfilled === RESOLVED;
		};

		this.isRejected = promise.isRejected = function() {
			return fulfilled === REJECTED;
		};

		this.isFulfilled = promise.isFulfilled = function() {
			return !!fulfilled;
		};

		this.isCanceled = promise.isCanceled = function() {
			return canceled;
		};

		this.progress = function( update, strict ) {
			if ( !fulfilled ) {
				signalWaiting( waiting, PROGRESS, update );
				return promise;
			} else if ( strict === true ) {
				throw new Error( FULFILLED_ERROR_MESSAGE );
			} else {
				return promise;
			}
		};

		this.resolve = function( value, strict ) {
			if ( !fulfilled ) {
				signalWaiting( waiting, fulfilled = RESOLVED, result = value );
				waiting = null;
				return promise;
			} else if ( strict === true ) {
				throw new Error( FULFILLED_ERROR_MESSAGE );
			} else {
				return promise;
			}
		};

		var reject = this.reject = function( error, strict ) {
			if ( !fulfilled ) {
				signalWaiting( waiting, fulfilled = REJECTED, result = error );
				waiting = null;
				return promise;
			} else if ( strict === true ) {
				throw new Error( FULFILLED_ERROR_MESSAGE );
			} else {
				return promise;
			}
		};

		this.then = promise.then = function( callback, errback, progback) {
			var listener = [ progback, callback, errback ];

			listener.cancel = promise.cancel;
			listener.deferred = new Deferred(function( reason ) {
				return listener.cancel && listener.cancel( reason );
			});

			if ( fulfilled && !waiting ) {
				signalListener( listener, fulfilled, result );
			} else {
				waiting.push( listener );
			}

			return listener.deferred.promise;
		};

		this.cancel = promise.cancel = function( reason, strict ) {
			if ( !fulfilled ) {
				if ( canceler ) {
					var returnedReason = canceler( reason );
					reason = typeof returnedReason === 'undefined' ? reason : returnedReason;
				}

				canceled = true;
				if ( !fulfilled ) {
					if ( typeof reason === 'undefined' ) {
						reason = new Error( CANCELED_ERROR_MESSAGE );
					}
					reject( reason );
					return reason;
				} else if ( fulfilled === REJECTED && result === reason ) {
					return reason;
				}
			} else if ( strict === true ) {
				throw new Error( FULFILLED_ERROR_MESSAGE );
			}
		};

		freezeObject( promise );
	};

	Deferred.prototype.toString = function() {
		return '[object Deferred]';
	};

	Deferred.Promise = Promise;

	function when(valueOrPromise, callback, errback, progback) {
		var receivedPromise = valueOrPromise && typeof valueOrPromise.then === "function";
		var nativePromise = receivedPromise && valueOrPromise instanceof Promise;

		if (!receivedPromise) {
			if (arguments.length > 1) {
				return callback ? callback(valueOrPromise) : valueOrPromise;
			} else {
				return new Deferred().resolve(valueOrPromise);
			}
		} else if (!nativePromise) {
			var deferred = new Deferred(valueOrPromise.cancel);
			valueOrPromise.then(deferred.resolve, deferred.reject, deferred.progress);
			valueOrPromise = deferred.promise;
		}

		if (callback || errback || progback) {
			return valueOrPromise.then(callback, errback, progback);
		}
		return valueOrPromise;
	}

	var some = lang.some;
	var each = lang.each;

	function promiseAll(objectOrArray, cancelIfAnyRejected) {
		var object, array;
		if (objectOrArray instanceof Array) {
			array = objectOrArray;
		} else if (objectOrArray && typeof objectOrArray === "object") {
			object = objectOrArray;
		}

		var results;
		var keyLookup = [];
		if (object) {
			array = [];
			for (var key in object) {
				if (Object.hasOwnProperty.call(object, key)) {
					keyLookup.push(key);
					array.push(object[key]);
				}
			}
			results = {};
		} else if (array) {
			results = [];
		}

		if (!array || !array.length) {
			return new Deferred().resolve(results);
		}

		var deferred = new Deferred(cancelIfAnyRejected ? function(reason) {
			each(array, function(valueOrPromise) {
				if (valueOrPromise.isFulfilled && !valueOrPromise.isCanceled() && !valueOrPromise.isFulfilled()) {
					valueOrPromise.cancel(reason);
				}
			});
			return reason;
		} : cancelIfAnyRejected);
		deferred.promise.always(function(){
			results = keyLookup = null;
		});
		var waiting = array.length;
		some(array, function(valueOrPromise, index) {
			if(!object){
				keyLookup.push(index);
			}
			when(valueOrPromise, function(value) {
				if (!deferred.isFulfilled()) {
					results[keyLookup[index]] = value;
					if (--waiting === 0) {
						deferred.resolve(results);
					}
				}
			}, deferred.reject);
			return deferred.isFulfilled() || deferred.isCanceled();
		});
		return deferred.promise;
	}

	Deferred.when = when;

	Deferred.ensure = function(objectOrArray, cancelIfAnyRejected) {
		return promiseAll(objectOrArray, cancelIfAnyRejected);
	};

	return Deferred
});