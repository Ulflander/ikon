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

    function fn(func) {
        if (!!ready) {
            func();
        } else if (typeof func === 'function') {
            readyCbs.push(func);
        }

        return fn;
    };

    fn.ajax = function(method, url, data, headers, cb, contentType) {

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

        return fn;
    };

    fn.solve = function(url, object) {
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

    fn.bulk = function(urls, cb) {
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
                    fn.load(url[0], url[1], function(err, data) {
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
                    fn.get(url, function(err, data) {
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

        return fn;
    };

    fn.get = function(url, cb) {
        return fn.ajax('GET', url, null, {}, function(err, data) {
            cb(err, data);
        });
    };

    fn.post = function(url, data, cb, parseJSON) {
        var cb2 = cb;
        if (parseJSON) {
            cb2 = function(err, data) {
                cb(err, typeof data === 'string' ? JSON.parse(data) : data);
            };
        }
        return fn.ajax('POST', url, data, {}, cb2);
    };

    fn.put = function(url, data, cb, parseJSON) {
        var cb2 = cb;
        if (parseJSON) {
            cb2 = function(err, data) {
                cb(err, typeof data === 'string' ? JSON.parse(data) : data);
            };
        }
        return fn.ajax('PUT', url, data, {}, cb2);
    };

    fn.delete = function(url, cb) {
        return fn.ajax('DELETE', url, null, {}, cb);
    };

    fn.load = function(url, modelName, cb) {
        return fn.get(url, function(err, data) {
            if (!!err) {
                cb(err, null);
                return;
            }

            cb(null, fn.materialize(modelName, JSON.parse(data)));
        });
    };

    fn.materialize = function(modelName, data) {
        var i, l, res;
        if (Array.isArray(data)) {
            for (i = 0, l = data.length; i < l; i += 1) {
                data[i] = fn.materialize(modelName, data[i]);
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

    fn.model = function(modelName, constructor, prototype) {
        for (var k in prototype) {
            if (prototype.hasOwnProperty(k)) {
                constructor.prototype[k] = prototype[k];
            }
        }
        store[modelName] = {};
        models[modelName] = constructor;
        return fn;
    };

    fn.template = function(template, cb) {
        if (templates.hasOwnProperty(template)) {
            cb(templates[template]);
            return fn;
        }
        fn.get(template + '.html', function(err, tpl) {
            if (!!err) {
                console.warn('Template not loaded: ' + template, err);
                tpl = '';
            } else {
                templates[template] = tpl;
            }
            cb(tpl);
        });
        return fn;
    };

    fn.view = function(selector, template, cb) {
        var el = $(selector),
            view;
        if (el === null) {
            console.warn('No element found for selector ' + selector);
            return;
        }
        el.innerHTML = '';
        ko.cleanNode(el);
        fn.template(template, function(tpl) {
            cb(function(vm) {
                el.innerHTML = tpl;
                if (!!vm && typeof ko !== 'undefined') {
                    ko.applyBindings(vm, el);
                }
            });
        });
        return fn;
    };

    fn.route = function (hash, cb) {
        router.add(fn.cleanHash(hash), cb);
        return fn;
    };

    fn.redirect = function (hash) {
        if (hash.indexOf('#') !== 0) {
            hash = '#' + hash;
        }
        w.location.hash = hash;
        return fn;
    };

    fn.cleanHash = function(hash) {
        while (hash[0] === '#' || hash[0] === '!' || hash[0] === '/') {
            hash = hash.slice(1);
        }
        return hash;
    };

    fn.extend = function(from, to) {
        var k;
        to = to || {};
        for (k in from) {
            if (from.hasOwnProperty(k)) {
                to[k] = from[k];
            }
        }
        return to;
    };

    fn.hasClass = function(node, className) {
        return node.className && new RegExp("(\\s|^)" + className + "(\\s|$)").test(node.className);
    };

    fn.addClass = function(node, className) {
        if (className && !fn.hasClass(node, className)) {
            node.className += ' ' + className;
        }
        return fn;
    };

    fn.removeClass = function(node, className) {
        if (className && fn.hasClass(node, className)) {
            node.className = node.className.replace(new RegExp('(^| )(' + className +')($| )', 'gi'), ' ');
        }
        return fn;
    };

    fn.Element = function(el, parent) {
        this.el_ = el;
        this.parent_ = parent || null;
    };

    fn.Element.prototype = {
        create: function(type) {
            var child = new fn.Element(d.createElement(type), this);
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
            fn.addClass.call(fn, this.el_, className);
            return this;
        },
        removeClass: function(className) {
            fn.addClass.call(fn, this.el_, className);
            return this;
        },
        hasClass: function() {
            return fn.hasClass.call(fn, this.el_, className);;
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
        height: function() {
            return this.el_.offsetHeight;
        },
        width: function() {
            return this.el_.offsetWidth;
        },
        appendTo: function(parent) {
            var p = parent;
            if (p instanceof fn.Element) {
                p = p.el();
            }
            p.appendChild(this.el_);
            return this;
        },
        el: function() {
            return this.el_;
        }
    };

    fn.select = function(selector) {
        return new fn.Element($(selector));
    };

    fn.create = function(type) {
        return new fn.Element(d.createElement(type));
    };

    fn.cookie = {
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
        router.run(fn.cleanHash(w.location.hash || ''));
    };

    w.addEventListener('hashchange', route);
    d.addEventListener('DOMContentLoaded', function() {
        ready = true;
        readyCbs.forEach(function(f) {
            f();
        });
        route();
    });

    w.fn = fn;

}());
