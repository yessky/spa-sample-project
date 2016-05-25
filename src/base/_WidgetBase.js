define(function(require, exports, module) {
	// module:
	//		base/_WidgetBase
	// summary:
	//		base Class for create Widget

	var lang = require("./lang");
	var declare = require("./declare");
	var Stateful = require("./Stateful");
	var aspect = require("./aspect");
	var on = require("./on");
	var dom = require("./dom");
	var registry = require("./registry");
	var blankGif = require("./url!./resources/blank.gif");

	return declare("base._WidgetBase", Stateful, {
		// a unique identifier for widget
		id: "",
		_idSetter: function(id) {
			dom.attr(this.domNode, "id", id);
			dom.attr(this.domNode, "widgetid", id)
		},

		// cssText string for this.domNode
		style: "",
		_styleSetter: function( value ) {
			var node = this.domNode;
			if ( typeof value === "object" ) {
				dom.css(node, value)
			} else {
				if ( node.style.cssText ) {
					node.style.cssText += "; " + value
				} else {
					node.style.cssText = value
				}
			}
		},

		// Root CSS class of the widge
		baseClass: "",

		// pointer to original DOM node
		srcNodeRef: null,

		// This is our visible representation of the widget
		domNode: null,

		// Designates where children of the source DOM node will be placed.
		containerNode: null,

		ownerDocument: null,

		blankGif: blankGif,

		postscript: function(params, srcNodeRef) {
			this.create(params, srcNodeRef)
		},

		// Kick off the life-cycle of a widget
		create: function(params, srcNodeRef) {
			this.__introspect();
			// store pointer to original DOM tree
			this.srcNodeRef = srcNodeRef;

			// mix in our passed parameters
			if (params) {
				this.__params = params;
				lang.mix(this, params)
			}
			this.postMixInProperties();

			// fill this.id
			if (!this.id) {
				this.id = registry.uid(this.declaredClass);
				if (this.params) { delete this.params.id }
			}

			// The document and <body> node this widget is associated with
			this.ownerDocument = this.ownerDocument || (this.srcNodeRef ? this.srcNodeRef.ownerDocument : document);
			this.ownerDocumentBody = this.ownerDocument.body;

			registry.add(this);
			this.buildRendering();

			var deleteSrcNodeRef;
			if (this.domNode) {
				this.__assign();
				var source = this.srcNodeRef;
				if (source && source.parentNode && this.domNode !== source) {
					source.parentNode.replaceChild(this.domNode, source);
					deleteSrcNodeRef = true
				}
				this.domNode.setAttribute("widgetid", this.id)
			}
			this.postCreate();

			if (deleteSrcNodeRef) {
				delete this.srcNodeRef
			}

			this.__created = true
		},

		// Collect metadata about this widget (only once per class, not once per instance)
		__introspect: function() {
			var ctor = this.constructor;
			if (!ctor.__setters) {
				var proto = ctor.prototype;
				var setters = ctor.__setters = [];
				for (var name in proto) {
					if (/^_(.*)Setter$/.test(name)) {
						name = name.substr(1, name.length - 7);
						setters.push(name)
					}
				}
			}
		},

		__assign: function() {
			var params = {};
			for (var key in (this.__params || {})) {
				params[key] = this._get(key)
			}

			// call set() for each prototype property
			lang.forEach(this.constructor.__setters, function(key) {
				if (!(key in params)) {
					var val = this._get(key);
					if (val !== undefined) { this.set(key, val) }
				}
			}, this);

			// call set() for each own property
			for (key in params) {
				this.set(key, params[key])
			}
		},

		// used set properties that are referenced in the widget template.
		// by default, I make it support "baseClass" inheritance.
		postMixInProperties: function() {
			var klass = [];
			var superclass = this.constructor;
			while (superclass) {
				var proto = typeof superclass === "function" ? superclass.prototype : superclass;
				if (proto.hasOwnProperty("baseClass") && proto.baseClass) {
					klass.unshift(proto.baseClass)
				}
				superclass = proto.constructor.superclass
			}
			if (this.hasOwnProperty("baseClass") && this.baseClass) {
				klass.push(this.baseClass)
			}
			klass = klass.join(" ").split(" ");
			this.baseClass = lang.unique(klass).join(" ")
		},

		//		Construct the UI for this widget, setting this.domNode.
		buildRendering: function() {
			if (!this.domNode) {
				this.domNode = this.srcNodeRef || this.ownerDocument.createElement("div")
			}

			if (this.baseClass) {
				dom.addClass(this.domNode, this.baseClass)
			}
		},

		// Processing after the DOM fragment created
		postCreate: lang.noop,

		// Processing after the DOM fragment is added to the document
		startup: function() {
			if (this.__started) { return }
			this.__started = true;
			lang.forEach(this.getChildren(), function(widget) {
				if (!widget.__started && !widget.__destroyed && lang.isFunction(widget.startup)) {
					widget.startup();
					widget.__started = true
				}
			})
		},

		// Destroy this widget and its descendants
		destroyRecursive: function(preserveDom) {
			this.__beingDestroyed = true;
			this.destroyDescendants(preserveDom);
			this.destroy(preserveDom)
		},

		destroy: function(preserveDom) {
			this.__beingDestroyed = true

			function destroy(widget) {
				if (widget.destroyRecursive) {
					widget.destroyRecursive(preserveDom)
				} else if (widget.destroy) {
					widget.destroy(preserveDom)
				}
			}

			if (this.domNode) {
				lang.forEach(registry.findWidgets(this.domNode, this.containerNode), destroy)
			}

			this.destroyRendering(preserveDom);
			registry.remove(this.id);
			this.__destroyed = true
		},

		destroyRendering: function(preserveDom) {
			if (this.domNode) {
				if (preserveDom) {
					dom.removeAttr(this.domNode, "widgetid")
				} else {
					dom.remove(this.domNode)
				}
				delete this.domNode
			}

			if (this.srcNodeRef) {
				if (!preserveDom) {
					dom.remove(this.srcNodeRef)
				}
				delete this.srcNodeRef
			}
		},

		destroyDescendants: function(preserveDom) {
			lang.forEach(this.getChildren(), function(widget) {
				if (widget.destroyRecursive) {
					widget.destroyRecursive(preserveDom)
				}
			})
		},

		// Track specified handles and remove/destroy them when this instance is destroyed
		own: function() {
			var dsmap = [
				"destroyRecursive",
				"destroy",
				"remove"
			];

			lang.forEach(arguments, function(handle) {
				var destroyMethodName;
				var odh = aspect.before(this, "destroy", function (preserveDom) {
					handle[destroyMethodName](preserveDom)
				});

				// Callback for when handle is manually destroyed.
				var hdhs = [];
				function onManualDestroy(){
					odh.remove();
					lang.forEach(hdhs, function(hdh){
						hdh.remove()
					})
				}

				if (handle.then) {
					destroyMethodName = "cancel";
					handle.then(onManualDestroy, onManualDestroy)
				} else {
					lang.forEach(dsmap, function(method) {
						if (typeof handle[method] === "function") {
							if (!destroyMethodName) {
								destroyMethodName = method
							}
							hdhs.push(aspect.after(handle, method, onManualDestroy, true))
						}
					})
				}
			}, this);

			return arguments
		},

		__accessors: {},

		_set: function(name, value) {
			var names = this.__getAccessor(name);
			var prev = this._get(name, names);
			if (this.__created) {
				this.inherited(arguments);
				this.emit(name + ":change", {
					detail: {
						name: name,
						previous: prev,
						value: value
					}
				})
			} else {
				this[name] = value
			}
		},

		emit: function(type, eventObj, callbackArgs) {
			eventObj = eventObj || {};
			if (eventObj.bubbles === undefined) {
				eventObj.bubbles = true
			}
			if (eventObj.cancelable === undefined) {
				eventObj.cancelable = true
			}
			if (!eventObj.detail) {
				eventObj.detail = {}
			}
			eventObj.detail.widget = this;

			if (this.__started && !this.__beingDestroyed) {
				on.emit(this.domNode, type, eventObj)
			}
		},

		on: function(type, func) {
			return this.own(on(this.domNode, type, func))[0]
		},

		toString: function() {
			return "[Widget " + this.declaredClass + ", " + (this.id || "NO ID") + "]"
		},

		getChildren: function() {
			return this.containerNode ? registry.findWidgets(this.containerNode) : []
		},

		getParent: function() {
			return registry.getEnclosingWidget(this.domNode.parentNode)
		},

		placeAt: function(reference, position) {	
			// position: "before/after/first/last/replace"
			var ref = typeof reference === "string" ? dom.byId(reference, this.ownerDocument) : reference;
			dom.place(this.domNode, ref, position);

			if (!this.__started) {
				var parent = this.getParent();
				if (!parent || parent.__started) {
					this.startup()
				}
			}

			return this
		},

		defer: function(fcn, delay) {
			var timer = setTimeout(lang.hitch(this, function() {
				if (!timer) { return }
				timer = null;
				if (!this.__destroyed) {
					lang.hitch(this, fcn)()
				}
			}), delay || 0);
			return {
				remove: function() {
					if (timer) {
						clearTimeout(timer);
						timer = null
					}
					return null
				}
			}
		}
	})
});