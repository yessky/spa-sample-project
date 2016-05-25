define(function(require, exports, module) {
	// module:
	// summary:
	//		An implemention of js OOP.

	var lang = require("./lang");
	var type = lang.type;
	var mix = lang.mix;
	var op = Object.prototype;
	var xtor = new Function;
	var counter = 0;
	var cname = 'constructor';

	function err( msg, cls ) {
		throw new Error('declare' + (cls ? ' ' + cls : '') + ': ' + msg);
	}

	// C3 Method Resolution Order (see http://www.python.org/download/releases/2.3/mro/)
	function c3mro( bases, className ) {
		var result = [], roots = [{cls: 0, refs: []}], nameMap = {}, clsCount = 1,
			l = bases.length, i = 0, j, lin, base, top, proto, rec, name, refs;

		// build a list of bases naming them if needed
		for ( ; i < l; ++i ) {
			base = bases[i];
			if ( !base ) {
				err('mixin #' + i + ' is unknown. Did you use "require" to pull it in?', className);
			} else if ( type(base) !== 'function' ) {
				err('mixin #' + i + ' is not a callable constructor.', className);
			}
			lin = base._meta ? base._meta.bases : [base];
			top = 0;
			// add bases to the name map
			for ( j = lin.length - 1; j >= 0; --j ) {
				proto = lin[j].prototype;
				if ( !proto.hasOwnProperty('declaredClass') ) {
					proto.declaredClass = 'uniqName_' + (counter++);
				}
				name = proto.declaredClass;
				if ( !nameMap.hasOwnProperty(name) ) {
					nameMap[name] = {count: 0, refs: [], cls: lin[j]};
					++clsCount;
				}
				rec = nameMap[name];
				if ( top && top !== rec ) {
					rec.refs.push(top);
					++top.count;
				}
				top = rec;
			}
			++top.count;
			roots[0].refs.push(top);
		}

		// remove classes without external references recursively
		while ( roots.length ) {
			top = roots.pop();
			result.push(top.cls);
			--clsCount;
			// optimization: follow a single-linked chain
			while ( refs = top.refs, refs.length === 1 ) {
				top = refs[0];
				if ( !top || --top.count ) {
					// branch or end of chain => do not end to roots
					top = 0;
					break;
				}
				result.push(top.cls);
				--clsCount;
			}
			if ( top ) {
				// branch
				for ( i = 0, l = refs.length; i < l; ++i ) {
					top = refs[i];
					if ( !--top.count ) {
						roots.push(top);
					}
				}
			}
		}

		if ( clsCount ) {
			err('can\'t build consistent linearization', className);
		}

		// calculate the superclass offset
		base = bases[0];
		result[0] = base ?
			base._meta && base === result[result.length - base._meta.bases.length] ?
				base._meta.bases.length : 1 : 0;

		return result;
	}

	function inherited( args, a, f ) {
		var name, chains, bases, caller, meta, base, proto, opf, pos,
			cache = this.__inherited__ = this.__inherited__ || {};

		// crack arguments
		if ( typeof args === 'string' ) {
			name = args;
			args = a;
			a = f;
		}
		f = 0;

		caller = args.callee;
		name = name || caller.nom;
		if ( !name ) {
			err( 'can\'t deduce a name to call inherited()', this.declaredClass );
		}

		meta = this.constructor._meta;
		bases = meta.bases;

		pos = cache.p;
		if ( name !== cname ) {
			// method
			if ( cache.c !== caller ) {
				// cache bust
				pos = 0;
				base = bases[0];
				meta = base._meta;
				if ( meta.hidden[name] !== caller ) {
					// find caller
					do {
						meta = base._meta;
						proto = base.prototype;
						if ( meta && (proto[name] === caller && proto.hasOwnProperty(name) || meta.hidden[name] === caller) ) {
							break;
						}
					} while ( base = bases[++pos] ); // intentional assignment
					pos = base ? pos : -1;
				}
			}
			// find next
			base = bases[++pos];
			if ( base ) {
				proto = base.prototype;
				if ( base._meta && proto.hasOwnProperty(name) ) {
					f = proto[name];
				} else {
					opf = op[name];
					do {
						proto = base.prototype;
						f = proto[name];
						if ( f && (base._meta ? proto.hasOwnProperty(name) : f !== opf) ) {
							break;
						}
					} while ( base = bases[++pos] ); // intentional assignment
				}
			}
			f = base && f || op[name];
		} else {
			// constructor
			if ( cache.c !== caller ) {
				// cache bust
				pos = 0;
				meta = bases[0]._meta;
				if ( meta && meta.ctor !== caller ) {
					// find caller
					while ( base = bases[++pos] ) { // intentional assignment
						meta = base._meta;
						if ( meta && meta.ctor === caller ) {
							break;
						}
					}
					pos = base ? pos : -1;
				}
			}
			// find next
			while ( base = bases[++pos] ) {	// intentional assignment
				meta = base._meta;
				f = meta ? meta.ctor : base;
				if ( f ) {
					break;
				}
			}
			f = base && f;
		}

		// cache the found super method
		cache.c = f;
		cache.p = pos;

		// now we have the result
		if ( f ) {
			return a === true ? f : f.apply( this, a || args );
		}
		// intentionally no return if a super method was not found
	}

	// emulation of 'instanceof'
	function isInstanceOf(cls) {
		var bases = this.constructor._meta.bases;
		for ( var i = 0, l = bases.length; i < l; ++i) {
			if (bases[i] === cls) {
				return true;
			}
		}
		return this instanceof cls;
	}

	function mixOwn(target, source) {
		// add props adding metadata for incoming functions skipping a constructor
		for ( var name in source ) {
			if ( name !== cname && source.hasOwnProperty(name) ) {
				target[name] = source[name];
			}
		}
	}

	function attachName( name, value ) {
		if ( type(value) === 'function' ) {
			value.nom = name;
		}
		return value;
	}

	// implementation of safe mixin function
	function safeMixin( target, source ) {
		var name, t;
		// add props adding metadata for incoming functions skipping a constructor
		for ( name in source ) {
			t = source[name];
			if ( (t !== op[name] || !(name in op)) && name !== cname ) {
				if ( type(t) === 'function' ) {
					// non-trivial function method => attach its name
					t.nom = name;
				}
				target[name] = t;
			}
		}
		return target;
	}

	// chained constructor compatible with the legacy declare()
	function chainedCtor( bases ) {
		return function() {
			var a = arguments, args = a, a0 = a[0], f, i, m,
				l = bases.length;

			if ( !(this instanceof a.callee) ) {
				// not called via new, so force it
				return applyNew(a);
			}

			// 2) call all non-trivial constructors using prepared arguments
			for ( i = l - 1; i >= 0; --i ) {
				f = bases[i];
				m = f._meta;
				f = m ? m.ctor : f;
				if ( f ) {
					f.apply( this, a );
				}
			}
			// 3) continue the original ritual: call the postscript
			f = this.postscript;
			if ( f ) {
				f.apply( this, args );
			}
		};
	}

	// chained constructor compatible with the legacy declare()
	function singleCtor( ctor ) {
		return function() {
			var a = arguments, t = a, a0 = a[0], f;

			if ( !(this instanceof a.callee) ) {
				// not called via new, so force it
				return applyNew(a);
			}

			// 2) call a constructor
			if ( ctor ) {
				ctor.apply( this, a );
			}
			// 3) continue the original ritual: call the postscript
			f = this.postscript;
			if ( f ) {
				f.apply( this, a );
			}
		};
	}

	// forceNew(ctor)
	// return a new object that inherits from ctor.prototype but
	// without actually running ctor on the object.
	function forceNew(ctor) {
		// create object with correct prototype using a do-nothing
		// constructor
		xtor.prototype = ctor.prototype;
		var t = new xtor;
		xtor.prototype = null;	// clean up
		return t;
	}

	// applyNew(args)
	// just like 'new ctor()' except that the constructor and its arguments come
	// from args, which must be an array or an arguments object
	function applyNew(args) {
		// create an object with ctor's prototype but without
		// calling ctor on it.
		var ctor = args.callee, t = forceNew(ctor);
		// execute the real constructor on the new object
		ctor.apply(t, args);
		return t;
	}

	function declare( className, superclass, props ) {
		// crack parameters
		if ( typeof className !== 'string' ) {
			props = superclass;
			superclass = className;
			className = '';
		} else {
			className = className.replace(/\//g, '.');
		}
		props = props || {};

		var proto, i, t, ctor, name, bases, chains, mixins = 1, parents = superclass;

		// build a prototype
		if ( type(superclass) === 'array' ) {
			// C3 MRO
			bases = c3mro( superclass, className );
			t = bases[0];
			mixins = bases.length - t;
			superclass = bases[mixins];
		} else {
			bases = [0];
			if ( superclass ) {
				if ( type(superclass) === 'function' ) {
					t = superclass._meta;
					bases = bases.concat(t ? t.bases : superclass);
				} else {
					err('base class is not a callable constructor.', className);
				}
			} else if ( superclass !== null ) {
				err('unknown base class. Did you use dojo.require to pull it in?', className);
			}
		}
		if ( superclass ) {
			for ( i = mixins - 1;; --i ) {
				proto = forceNew(superclass);
				if ( !i ) {
					// stop if nothing to add (the last base)
					break;
				}
				// mix in properties
				t = bases[i];
				(t._meta ? mixOwn : mix)( proto, t.prototype, attachName );
				// chain in new constructor
				ctor = new Function;
				ctor.superclass = superclass;
				ctor.prototype = proto;
				superclass = proto.constructor = ctor;
			}
		} else {
			proto = {};
		}
		safeMixin( proto, props );
		// add constructor
		t = props.constructor;
		if ( t !== op.constructor ) {
			t.nom = cname;
			proto.constructor = t;
		}

		bases[0] = ctor = (bases.length === 1 ? singleCtor(props.constructor) : chainedCtor(bases));

		// add meta information to the constructor
		ctor._meta  = {bases: bases, hidden: props, parents: parents, ctor: props.constructor};
		ctor.superclass = superclass && superclass.prototype;
		ctor.prototype = proto;
		proto.constructor = ctor;

		// add 'standard' methods to the prototype
		proto.isInstanceOf = isInstanceOf;
		proto.inherited    = inherited;

		// add name if specified
		if ( className ) {
			proto.declaredClass = className;
		}

		// chained methods do not return values
		// no need to chain 'invisible' functions

		return ctor;	// Function
	}

	module.exports = declare;
});