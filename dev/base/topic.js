define(function(require, exports, module) {
	// module: base/topic
	// summary:
	// 		subscribe/publish pattern implemention

	var Evented = require("./Evented");
	var hub = new Evented;

	module.exports = {
		subscribe: function(topic, callback) {
			return hub.on.apply(hub, arguments)
		},
		publish: function(topic, args) {
			return hub.emit.apply(hub, arguments)
		}
	};
});