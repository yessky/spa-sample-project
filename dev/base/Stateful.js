define(function(require, exports, module) {
	// module:
	//		base/Stateful
	// summary:
	//		Base class for objects that provide named properties with optional getter/setter
	//		control and the ability to watch for property changes

	var lang = require("./lang");
	var declare = require("./declare");
	var Deferred = require("./Deferred");

	var slice = Array.prototype.slice;

	return declare("base.Stateful", null, {
		// attribute accessor cache
		__accessors: {},

		__getAccessor: function(name) {
			var map = this.__accessors;
			if (map[name]) { return map[name] }
			var camel = lang.camelize(name);
			return (map[name] = {
				s: "_" + camel + "Setter",
				g: "_" + camel + "Getter"
			})
		},

		postscript: function(params) {
			if (params) { this.set(params) }
		},

		_get: function(name, names) {
			return this[name]
		},
		get: function(name) {
			var names = this.__getAccessor(name);
			return lang.isFunction(this[names.g]) ? this[names.g]() : this._get(name)
		},
		_set: function(name, value) {
			var names = this.__getAccessor(name);
			var prev = this._get(name, names);
			this[name] = value;
			// check if changed and emit event
			if (!lang.isEqual(prev, value) && this.__notify) {
				var context = this;
				Deferred.when(value, function() {
					context.__notify(name, prev, value)
				})
			}
		},
		set: function(name, value) {
			if (typeof name === "object") {
				for (var x in name) {
					if (name.hasOwnProperty(x) && x !== "__notify") {
						this.set(x, name[x])
					}
				}
				return this
			}
	
			var names = this.__getAccessor(name);
			var setter = this[names.s];
			var result;

			// call its setter if exists
			if (lang.isFunction(setter)) {
				result = setter.apply(this, slice.call(arguments, 1))
			}
			// apply to value
			this._set(name, result === undefined ? value : result);
			return this
		},
		// Watches a property for changes
		watch: function(name, callback) {
			var notifier = this.__notify;
			if (!notifier) {
				var context = this;
				notifier = this.__notify = function(name, oldValue, value, ignoreAll) {
					var notify = function(callbacks) {
						if (callbacks) {
							callbacks = callbacks.slice();
							for (var i = 0, l = callbacks.length; i < l; i++) {
								callbacks[i].call(context, name, oldValue, value)
							}
						}
					};
					notify(notifier['_' + name]);
					if (!ignoreAll) {
						notify(notifier["*"])
					}
				}
			}
			if (!callback && typeof name === "function") {
				callback = name;
				name = "*"
			} else {
				name = "_" + name
			}
			var callbacks = notifier[name];
			if (typeof callbacks !== "object") {
				callbacks = notifier[name] = []
			}
			callbacks.push(callback);

			var handle = {};
			handle.remove = function() {
				var index = lang.indexOf(callbacks, callback);
				if (index > -1) {
					callbacks.splice(index, 1)
				}
			};
			return handle
		}
	})
});