// This library started as an experiment to see how small I could make
// a functional router. It has since been optimized (and thus grown).
// The redundancy and inelegance here is for the sake of either size
// or speed.
function Rlite() {
  var routes = {},
      decode = decodeURIComponent;

  function noop(s) { return s; }

  function sanitize(url) {
    ~url.indexOf('/?') && (url = url.replace('/?', '?'));
    url[0] == '/' && (url = url.slice(1));
    url[url.length - 1] == '/' && (url = url.slice(0, -1));

    return url;
  }

  function processUrl(url, esc) {
    var pieces = url.split('/'),
        rules = routes,
        params = {};

    for (var i = 0; i < pieces.length && rules; ++i) {
      var piece = esc(pieces[i]);
      rules = rules[piece.toLowerCase()] || rules[':'];
      rules && rules[':'] && (params[rules[':']] = piece);
    }

    return rules && {
      cb: rules['@'],
      params: params
    };
  }

  function processQuery(url, ctx, esc) {
    if (url && ctx.cb) {
      var hash = url.indexOf('#'),
          query = (hash < 0 ? url : url.slice(0, hash)).split('&');

      for (var i = 0; i < query.length; ++i) {
        var nameValue = query[i].split('=');

        ctx.params[nameValue[0]] = esc(nameValue[1]);
      }
    }

    return ctx;
  }

  function lookup(url) {
    var querySplit = sanitize(url).split('?'),
        esc = ~url.indexOf('%') ? decode : noop;

    return processQuery(querySplit[1], processUrl(querySplit[0], esc) || {}, esc);
  }

  return {
    add: function(route, handler) {
      var pieces = route.toLowerCase().split('/'),
          rules = routes;

      for (var i = 0; i < pieces.length; ++i) {
        var piece = pieces[i],
            name = piece[0] == ':' ? ':' : piece;

        rules = rules[name] || (rules[name] = {});

        name == ':' && (rules[':'] = piece.slice(1));
      }

      rules['@'] = handler;
    },

    exists: function (url) {
      return !!lookup(url).cb;
    },

    lookup: lookup,

    run: function(url) {
      var result = lookup(url);

      result.cb && result.cb({
        url: url,
        params: result.params
      });

      return !!result.cb;
    }
  };
}

(function (root, factory) {
  var define = root.define;

  if (define && define.amd) {
    define([], factory);
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  }
}(this, function () { return Rlite; }));

/*!
 * cookie-monster - a simple cookie library
 * v0.3.0
 * https://github.com/jgallen23/cookie-monster
 * copyright Greg Allen 2014
 * MIT License
*/
var monster = {
  set: function(name, value, days, path, secure) {
    var date = new Date(),
        expires = '',
        type = typeof(value),
        valueToUse = '',
        secureFlag = '';
    path = path || "/";
    if (days) {
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + date.toUTCString();
    }
    if (type === "object"  && type !== "undefined") {
        if(!("JSON" in window)) throw "Bummer, your browser doesn't support JSON parsing.";
        valueToUse = encodeURIComponent(JSON.stringify({v:value}));
    } else {
      valueToUse = encodeURIComponent(value);
    }
    if (secure){
      secureFlag = "; secure";
    }

    document.cookie = name + "=" + valueToUse + expires + "; path=" + path + secureFlag;
  },
  get: function(name) {
    var nameEQ = name + "=",
        ca = document.cookie.split(';'),
        value = '',
        firstChar = '',
        parsed={};
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0) == ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        value = decodeURIComponent(c.substring(nameEQ.length, c.length));
        firstChar = value.substring(0, 1);
        if(firstChar=="{"){
          try {
            parsed = JSON.parse(value);
            if("v" in parsed) return parsed.v;
          } catch(e) {
            return value;
          }
        }
        if (value=="undefined") return undefined;
        return value;
      }
    }
    return null;
  },
  remove: function(name) {
    this.set(name, "", -1);
  },
  increment: function(name, days) {
    var value = this.get(name) || 0;
    this.set(name, (parseInt(value, 10) + 1), days);
  },
  decrement: function(name, days) {
    var value = this.get(name) || 0;
    this.set(name, (parseInt(value, 10) - 1), days);
  }
};

(function(){

    var d = document,
        w = window,
        templates = {},
        models = {},
        store = {},
        readyCbs = [],
        ready = false,
        router = new Rlite(),
        $ = d.querySelector.bind(d),
        Base = function() {};

    function ikon(e) {
        if (typeof e === 'string') {
            return ikon.select(e);
        } else if (typeof e === 'function') {
            if (!!ready) {
                func();
            } else if (typeof func === 'function') {
                readyCbs.push(func);
            }
        } else if (e instanceof w.Element) {
            return new ikon.Element(e);
        }

        return ikon;
    };

    ikon.ajax = function(method, url, data, headers, cb, contentType) {

        var xhr = new XMLHttpRequest(),
            hasBody = (method === 'PUT' || method === 'POST'),
            responded = false, k;

        contentType = contentType || 'application/json';
        headers = headers || {};

        xhr.onreadystatechange = function() {
            if (!!responded || xhr.readyState < 4) {
                return;
            }

            if(xhr.status < 200 || xhr.status > 204) {
                responded = true;
                cb({}, null, xhr.status);
                return;
            }

            if(xhr.readyState === 4) {
                responded = true;
                cb(null, xhr.responseText, xhr.status);
            }
        };

        xhr.open(method, url, true);
        xhr.setRequestHeader('Content-Type', contentType);

        for (k in headers) {
            if (headers.hasOwnProperty(k)) {
                xhr.setRequestHeader(k, headers[k]);
            }
        }

        if (hasBody) {
            if (contentType === 'application/json' && typeof data !== 'string') {
                data = JSON.stringify(data || {});
            } else if (!data) {
                data = '';
            }

            xhr.send(data);
        } else {
            xhr.send();
        }

        return ikon;
    };

    ikon.solve = function(url, object) {
        var a = url.split('/'),
            i, l = a.length, key;

        for (i = 0; i < l; i += 1) {
            if (a[i].indexOf(':') === 0) {
                key = a[i].slice(1);
                if (object.hasOwnProperty(key)) {
                    if (typeof object[key] === 'function') {
                        a[i] = object[key]();
                    } else {
                        a[i] = object[key];
                    }
                }
            }
        }
        return a.join('/');
    };

    ikon.bulk = function(urls, cb) {
        var k,
            l = 0,
            url,
            allDone = false,
            hasError,
            res = {};


        for(k in urls) {
            l += 1;
            url = urls[k];
            // Url is array: we load a model
            // (either a unique one or an array of them)
            if (Array.isArray(url)) {
                (function bulk_load(k){
                    ikon.load(url[0], url[1], function(err, data) {
                        hasError = !!err || hasError;
                        res[k] = data;
                        l -= 1;
                        if (l === 0 && allDone) {
                            cb(hasError, res);
                        }
                    });
                }(k));
            // Otherwise if string we only get
            // the URL if it's a string
            } else if (typeof url === 'string') {
                (function bulk_get(k){
                    ikon.get(url, function(err, data) {
                        hasError = !!err || hasError;
                        res[k] = data;
                        l -= 1;
                        if (l === 0 && allDone) {
                            cb(hasError, res);
                        }
                    });
                }(k));
            }
        }

        allDone = true;
        if (l === 0) {
            cb(null, res);
        }

        return ikon;
    };

    ikon.get = function(url, cb) {
        return ikon.ajax('GET', url, null, {}, function(err, data) {
            cb(err, data);
        });
    };

    ikon.post = function(url, data, cb, parseJSON) {
        var cb2 = cb;
        if (parseJSON) {
            cb2 = function(err, data) {
                cb(err, typeof data === 'string' ? JSON.parse(data) : data);
            };
        }
        return ikon.ajax('POST', url, data, {}, cb2);
    };

    ikon.put = function(url, data, cb, parseJSON) {
        var cb2 = cb;
        if (parseJSON) {
            cb2 = function(err, data) {
                cb(err, typeof data === 'string' ? JSON.parse(data) : data);
            };
        }
        return ikon.ajax('PUT', url, data, {}, cb2);
    };

    ikon.delete = function(url, cb) {
        return ikon.ajax('DELETE', url, null, {}, cb);
    };

    ikon.load = function(url, modelName, cb) {
        return ikon.get(url, function(err, data) {
            if (!!err) {
                cb(err, null);
                return;
            }

            cb(null, ikon.materialize(modelName, JSON.parse(data)));
        });
    };

    ikon.materialize = function(modelName, data) {
        var i, l, res;
        if (Array.isArray(data)) {
            for (i = 0, l = data.length; i < l; i += 1) {
                data[i] = ikon.materialize(modelName, data[i]);
            }
            return data;
        }

        res = new Base();
        models[modelName](res);

        if (typeof data !== 'undefined') {
            if (typeof data === 'object' && typeof res.fromJSON === 'function') {
                res.fromJSON(data);
            }
            if (data.hasOwnProperty('id') && !!data.id) {
                store[modelName][data.id] = data;
            }
        }
        return res;
    };

    ikon.model = function(modelName, constructor, prototype) {
        for (var k in prototype) {
            if (prototype.hasOwnProperty(k)) {
                constructor.prototype[k] = prototype[k];
            }
        }
        store[modelName] = {};
        models[modelName] = constructor;
        return ikon;
    };

    ikon.template = function(template, cb) {
        if (templates.hasOwnProperty(template)) {
            cb(templates[template]);
            return ikon;
        }
        ikon.get(template + '.html', function(err, tpl) {
            if (!!err) {
                console.warn('Template not loaded: ' + template, err);
                tpl = '';
            } else {
                templates[template] = tpl;
            }
            cb(tpl);
        });
        return ikon;
    };

    ikon.view = function(selector, template, cb) {
        var el = $(selector),
            view;
        if (el === null) {
            console.warn('No element found for selector ' + selector);
            return;
        }
        el.innerHTML = '';
        ko.cleanNode(el);
        ikon.template(template, function(tpl) {
            cb(function(vm) {
                el.innerHTML = tpl;
                if (!!vm && typeof ko !== 'undefined') {
                    ko.applyBindings(vm, el);
                }
            });
        });
        return ikon;
    };

    ikon.route = function (hash, cb) {
        router.add(ikon.cleanHash(hash), cb);
        return ikon;
    };

    ikon.redirect = function (hash) {
        if (hash.indexOf('#') !== 0) {
            hash = '#' + hash;
        }
        w.location.hash = hash;
        return ikon;
    };

    ikon.cleanHash = function(hash) {
        while (hash[0] === '#' || hash[0] === '!' || hash[0] === '/') {
            hash = hash.slice(1);
        }
        return hash;
    };

    ikon.extend = function(from, to) {
        var k;
        to = to || {};
        for (k in from) {
            if (from.hasOwnProperty(k)) {
                to[k] = from[k];
            }
        }
        return to;
    };

    ikon.hasClass = function(node, className) {
        return node.className && new RegExp("(\\s|^)" + className + "(\\s|$)").test(node.className);
    };

    ikon.addClass = function(node, className) {
        if (className && !ikon.hasClass(node, className)) {
            node.className += ' ' + className;
        }
        return ikon;
    };

    ikon.removeClass = function(node, className) {
        if (className && ikon.hasClass(node, className)) {
            node.className = node.className.replace(new RegExp('(^| )(' + className +')($| )', 'gi'), ' ');
        }
        return ikon;
    };

    ikon.Element = function(el, parent) {
        this.el_ = el;
        this.parent_ = parent || null;
    };

    ikon.Element.prototype = {
        create: function(type) {
            var child = new ikon.Element(d.createElement(type), this);
            child.appendTo(this);
            return child;
        },
        parent: function() {
            return this.parent_;
        },
        root: function() {
            var p = this;
            while (p.parent_) {
                p = p.parent_;
            }
            return p;
        },
        attr: function(key, value) {
            if (arguments.length === 2) {
                this.el_.setAttribute(key, value);
                return this;
            }
            return this.el_.getAttribute(key);
        },
        style: function(key, value) {
            if (arguments.length === 2) {
                this.el_.style[key] = value;
                return this;
            }
            return this.el_.style[key];
        },
        addClass: function(className) {
            ikon.addClass.call(ikon, this.el_, className);
            return this;
        },
        removeClass: function(className) {
            ikon.removeClass.call(ikon, this.el_, className);
            return this;
        },
        hasClass: function(className) {
            return ikon.hasClass.call(ikon, this.el_, className);
        },
        text: function(text) {
            this.el_.innerText = text;
            return this;
        },
        html: function(html) {
            this.el_.innerHTML = html;
            return this;
        },
        remove: function() {
            if (this.el_.parentNode) {
                this.el_.parentNode.removeChild(this.el_);
            }
            return this;
        },
        empty: function() {
            this.html('');
            return this;
        },
        on: function(evt, cb) {
            this.el_.addEventListener(evt, cb);
            return this;
        },
        off: function(evt, cb) {
            this.el_.removeEventListener(evt, cb);
            return this;
        },
        height: function(v) {
            if (arguments.length) {
                this.style('height', v + 'px');
                return this;
            }
            return this.el_.offsetHeight;
        },
        width: function(v) {
            if (arguments.length) {
                this.style('width', v + 'px');
                return this;
            }
            return this.el_.offsetWidth;
        },
        left: function(v) {
            if (arguments.length) {
                this.style('left', v + 'px');
                return this;
            }
            return this.el_.offsetLeft;
        },
        top: function(v) {
            if (arguments.length) {
                this.style('top', v + 'px');
                return this;
            }
            return this.el_.offsetTop;
        },
        appendTo: function(parent) {
            var p = parent;
            if (p instanceof ikon.Element) {
                p = p.el();
            }
            p.appendChild(this.el_);
            return this;
        },
        el: function() {
            return this.el_;
        }
    };

    ikon.select = function(selector) {
        return new ikon.Element($(selector));
    };

    ikon.create = function(type) {
        return new ikon.Element(d.createElement(type));
    };

    ikon.fn = function(name, handler) {
        // To be replaced by prototype based
        ikon.fn[name] = handler;
    };

    ikon.cookie = {
        get: function() {
            return monster.get.apply(w, arguments);
        },
        set: function() {
            return monster.set.apply(w, arguments);
        },
        remove: function() {
            return monster.remove.apply(w, arguments);
        }
    };

    var route = function() {
        router.run(ikon.cleanHash(w.location.hash || ''));
    };

    w.addEventListener('hashchange', route);
    d.addEventListener('DOMContentLoaded', function() {
        ready = true;
        readyCbs.forEach(function(f) {
            f();
        });
        route();
    });

    w.ikon = ikon;

}());
