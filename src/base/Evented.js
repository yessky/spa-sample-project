define(function(require, exports, module) {
	// module: Evented
	// summary:
	// 		Evented base class

	var lang = require("./lang");
	var declare = require("./declare");

	return declare("Evented", null, {
		emit: function(type) {
			var queue = this.__events__ && this.__events__[type];
			var args = [].slice.call(arguments, 1);
			queue && lang.forEach(queue.slice(0), function(listener, i) {
				listener.apply(null, args)
			});
		},
		on: function(type, listener) {
			var events = this.__events__ || (this.__events__ = {});
			var queue = events[type] || (events[type] = []);
			queue.push(listener);
			return {
				remove:function() {
					for (var i = 0; i < queue.length; i++) {
						if (queue[i] === listener) {
							return queue.splice(i, 1)
						}
					}
				}
			}
		}
	})
});