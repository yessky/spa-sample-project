define(function(require, exports, module) {
	// module:
	//		base/parser
	// summary:
	//		The Dom/Widget parsing package

	var lang = require("./lang");
	var Deferred = require("./Deferred");
	var KS = require("./kernel");
	var dom = require("./dom");

	function evaluate(text, context) {
	 	var result = new Function("with(this){return (" + text + ")}").call(context);
	 	for (var p in result) {
	 		var value = result[p];
	 		if (typeof value === "function") {
	 			result[p] = lang.hitch(context, value)
	 		}
	 	}
	 	return result
	}

	var parser = {
		// Takes array of nodes, and turns them into class instances and
		// potentially calls a startup method to allow them to connect with
		// any children.
		instantiate: function(nodes, mixin, options) {
			mixin = mixin || {};
			options = options || {};

			var prefix = (options.scope || KS.config.scopeName) + "-";
			var ksType = prefix + "type"; // "ks-type"
			var list = [];
			lang.forEach(nodes, function(node) {
				var type = mixin.type || node.getAttribute(ksType);
				if (type) {
					list.push({ node: node, type: type })
				}
			});

			return this._instantiate(list, mixin, options)
		},

		_instantiate: function(nodes, mixin, options) {
			var req = options.contextRequire || require;
			// Call widget constructors.   Some may be asynchronous and return promises.
			var thelist = lang.map(nodes, function(obj) {
				var ctor = obj.ctor || req(obj.type);
				if (!ctor) {
					throw new Error("Unable to resolve constructor for: '" + obj.type + "'")
				}
				return this.construct(ctor, obj.node, mixin, options)
			}, this);

			return Deferred.ensure(thelist).then(function(thelist) {
				// startup child widgets after parent constructed
				if (!mixin.__started && !options.noStart) {
					lang.forEach(thelist, function(instance) {
						if (typeof instance.startup === "function" && !instance.__started) {
							instance.startup()
						}
					})
				}
				return thelist
			})
		},

		// Calls new ctor(params, node), where params is the hash of parameters specified on the node,
		// Does not call startup().
		construct: function(ctor, node, mixin, options) {
			var proto = ctor && ctor.prototype;
			options = options || {};

			var params = {};

			if (options.defaults) {
				lang.mix(params, options.defaults)
			}

			var scopeName = options.scope || KS.config.scopeName;
			var prefix = scopeName + "-";
			var hash = {};
			if (scopeName !== "ks") {
				hash[prefix + "props"] = "ks-props";
				hash[prefix + "type"] = "ks-type";
				hash[prefix + "id"] = "ks-id"
			}

			var attributes = node.attributes;
			var i = 0, item, extra;
			while (item = attributes[i++]) {
				var name = item.name;
				var uc = name.toLowerCase();
				var value = item.value;

				switch (hash[uc] || uc) {
					case "ks-type":
						break;
					case "ks-props":
						extra = value;
						break;
					case "ks-id":
						params.id = value;
						break;
					case "ks-name":
						params.ksAttachName = value;
						break;
					case "ks-event":
						params.ksAttachEvent = value;
						break;
					case "style":
						params.style = node.style && node.style.cssText;
						break;
					default:
						// TODO: fix or remove it
						params[name] = value
				}
			}

			if (extra) {
				try {
					extra = evaluate("{" + extra + "}", options.context);
					lang.mix(params, extra)
				} catch (err) {
					return err
				}
			}

			lang.mix(params, mixin);

			// create the instance
			var markupFactory = ctor.markupFactory || proto.markupFactory;
			var instance = markupFactory ? markupFactory(params, node, ctor) : new ctor(params, node);

			if (instance.then) {
				return instance.then(function(instance) {
					return instance
				})
			} else {
				return instance
			}
		},

		// Scan a DOM tree and return an array of objects representing the DOMNodes
		// that need to be turned into widgets.
		scan: function(root, options) {
			var list = [];
			var mids = [];

			var scopeName = options.scope || KS.config.scopeName;
			var prefix = scopeName + "-";
			var ksType = prefix + "type";
			var req = options.contextRequire || require;

			// Info on DOMNode currently being processed
			var node = root.firstChild;
			// Metadata about parent node
			var parent = {};
			var scriptsOnly;
			// DFS on DOM tree, collecting nodes with data-dojo-type specified.
			while (true) {
				if (!node) {
					// continue to parent's next sibling
					if (!parent || !parent.node) { break }
					node = parent.node.nextSibling;
					scriptsOnly = false;
					parent = parent.parent;
					continue
				}

				if (node.nodeType !== 1) {
					node = node.nextSibling;
					continue
				}

				// no need to entry script/style/link node
				if (scriptsOnly || /^script$|^style$|^link$/.test(node.nodeName.toLowerCase())) {
					node = node.nextSibling;
					continue
				}

				var type = node.getAttribute(ksType);
				var firstChild = node.firstChild;
				if (!type && (!firstChild || (firstChild.nodeType === 3 && !firstChild.nextSibling))) {
					node = node.nextSibling;
					continue
				}

				// Meta data about current node
				var current;
				var ctor = null;
				if (type) {
					try { ctor = req(type) } catch (e) {}

					// check async modules
					if (!ctor && (~type.indexOf("/"))) {
						mids.push(type)
					}

					// Setup meta data about this widget node, and save it to list of nodes to instantiate
					current = {
						type: type,
						ctor: ctor,
						parent: parent,
						node: node
					};
					list.push(current)
				} else {
					// non-widget node
					current = {
						node: node,
						parent: parent
					}
				}

				scriptsOnly = node.stopParser || (ctor && ctor.prototype.stopParser && !(options.template));
				parent = current;
				node = firstChild
			}

			var def = new Deferred();

			// If there are modules to load then require them in
			if (mids.length) {
				mids = lang.unique(mids);
				req(mids, function() {
					def.resolve(lang.filter(list, function(widget) {
						if (!widget.ctor) {
							try {
								widget.ctor = req(widget.type)
							} catch (e) {}
						}

						// Get the parent widget
						var parent = widget.parent;
						while (parent && !parent.type) {
							parent = parent.parent
						}

						var proto = widget.ctor && widget.ctor.prototype;
						widget.instantiateChildren = !(proto && proto.stopParser && !(options.template));
						widget.instantiate = !parent || (parent.instantiate && parent.instantiateChildren);
						return widget.instantiate
					}))
				})
			} else {
				def.resolve(list)
			}

			return def.promise
		},

		// Scan the DOM for class instances, and instantiate them.
		parse: function(rootNode, options) {
			// determine the root node and options based on the passed arguments.
			var root;
			if (!options && rootNode && rootNode.rootNode) {
				options = rootNode;
				root = options.rootNode
			} else if (rootNode && lang.isObject(rootNode) && !("nodeType" in rootNode)) {
				options = rootNode
			} else {
				root = rootNode
			}
			root = root ? dom.byId(root) : document.body;
			options = options || {};

			var mixin = options.template ? {template: true} : {};
			var instances = [];
			var context = this;

			var result = this.scan(root, options).then(function(parsedNodes) {
				return context._instantiate(parsedNodes, mixin, options)
			}).then(function(_instances) {
				return instances = instances.concat(_instances)
			}).otherwise(function(e) {
				console.error("base/parser::parse() error", e);
				throw e
			});

			// Blend the array with the promise
			lang.mix(instances, result);
			return instances
		}
	};

	if (KS.config.parseOnReady) {
		require.ready(lang.hitch(parser, "parse"))
	}

	return parser
});