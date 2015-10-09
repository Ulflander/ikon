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
        } else if (e instanceof w.Element || e instanceof w.Window) {
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
