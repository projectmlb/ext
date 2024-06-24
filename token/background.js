(async () => {
    console.clear();
    console.log('chrome.runtime.id', chrome.runtime.id);

    // To get a static extension ID for development:
    // Path extension at chrome://extensions
    // Install the .crx file and note the extension ID "EXT_ID"
    // Find profile path at chrome://version/
    // Nagivate to profile path/Extensions/"EXT_ID"/...
    // Copy the key field from `manifest.json` and paste into development manifest.json
    // This permanently sets the extension ID to "EXT_ID" for development
    const EXT_ID = 'fjchligkeaclbpjkndpopkladmhpcjii';  // Since Chrome 107, <all_urls> can be used in "externally_connectable"

    const API_TYPE = 'Jobs';  // Jobs | Worker
    const DEBUG = false;
    const VERBOSE = false;
    const URLS = {
        recaptcha: 'https://www.google.com/recaptcha/api.js',
        enterprise: 'https://recaptcha.net/recaptcha/enterprise.js',
        hcaptcha: 'https://js.hcaptcha.com/1/api.js',
        turnstile: 'https://challenges.cloudflare.com/turnstile/v0/api.js',
    };
    const TIMEOUTS = {
        recaptcha: 120,
        hcaptcha: 120,
        turnstile: 30,
    };
    const ENDPOINT = 'https://api.nopecha.com/_worker';
    // const ENDPOINT = 'https://legacy-api.nopecha.com/_worker';

    let last_ping = 0;

    class API {
        static endpoints = {};

        static register(obj, fname) {
            const names = [obj.name];
            // `${obj.name}.${fname}`;
            const split = fname.split('.');
            for (const [i, e] of split.entries()) {
                names.push(e);
                if (i < split.length - 1) obj = obj[e];
                else fname = e;
            }
            const endpoint = names.join('.');
            const fn = obj[fname];
            function wrapped() {
                return fn.apply(obj, [{ tab_id: arguments[0].tab_id, frame_id: arguments[0].frame_id, ...arguments[0].data }]);
            }
            this.endpoints[endpoint] = wrapped;
            console.log('registered', endpoint);
        }

        static start() {
            const callback = (req, sender, send) => {
                const method = req[0];
                let data = null;
                if (req.length > 1) {
                    if (req.length === 2) {
                        data = req[1];
                    }
                    else {
                        data = req.slice(1);
                    }
                }
                const tab_id = (data && 'tab_id' in data) ? data.tab_id : sender?.tab?.id;
                const frame_id = sender?.frameId;

                if (!(method in API.endpoints)) {
                    console.error('invalid method', method);
                    return false;
                }

                try {
                    Promise.resolve(API.endpoints[method]({ tab_id, frame_id, data }))
                        .then(r => {
                            const verbose = ![].includes(method);
                            if (verbose) console.log(method, r);

                            try {
                                send(r);
                            } catch (e) {
                                console.error('error in send\n', method, '\n', data, e);
                            }
                        })
                        .catch(e => {
                            console.error('error in api method\n', method, '\n', data, e);
                        });
                } catch (e) {
                    console.error('error in api call\n', method, '\n', data, e);
                }

                return true;
            };
            chrome.runtime.onMessage.addListener(callback);
            chrome.runtime.onMessageExternal.addListener(callback);
        }
    }

    class Config {
        static async get() {
            return {
                EXT_ID,
                DEBUG,
                VERBOSE,
                API_TYPE,
                URLS,
                TIMEOUTS,
            };
        }
    }
    API.register(Config, 'get');

    class Time {
        static sleep(i=1000) {
            return new Promise(resolve => setTimeout(resolve, i));
        }
    }

    class Util {
        static CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

        static generate_id(n) {
            let result = '';
            for (let i = 0; i < n; i++) {
                result += Util.CHARS.charAt(Math.floor(Math.random() * Util.CHARS.length));
            }
            return result;
        }

        static generate_sec_ch(ua) {
            try {
                const headers = {
                    'sec-ch-ua': null,
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Unknown"',
                };

                // Detect browser type and version
                if (/Chrome\/(\S+)/.test(ua)) {
                    let version = ua.match(/Chrome\/(\S+)/)[1];
                    version = version.split('.')[0];
                    headers['sec-ch-ua'] = `"Google Chrome";v="${version}", " Not A;Brand";v="99", "Chromium";v="${version}"`;
                } else if (/Opera\/(\S+)/.test(ua)) {
                    const version = ua.match(/Opera\/(\S+)/)[1];
                    headers['sec-ch-ua'] = `"Opera";v="${version}"`;
                } else if (/Brave\/(\S+)/.test(ua)) {
                    const version = ua.match(/Brave\/(\S+)/)[1];
                    headers['sec-ch-ua'] = `"Brave";v="${version}"`;
                } else if (/Edg\/(\S+)/.test(ua)) {
                    const version = ua.match(/Edg\/(\S+)/)[1];
                    headers['sec-ch-ua'] = `"Edg";v="${version}"`;
                } else {
                    return null;
                }

                if (/Mobi|Android/i.test(ua)) {
                    headers['sec-ch-ua-mobile'] = '?1';
                }

                if (ua.includes('Windows')) {
                    headers['sec-ch-ua-platform'] = '"Windows"';
                } else if (ua.includes('Mac OS X')) {
                    headers['sec-ch-ua-platform'] = '"Mac OS X"';
                } else if (ua.includes('Mac OS')) {
                    headers['sec-ch-ua-platform'] = '"macOS"';
                } else if (ua.includes('Android')) {
                    headers['sec-ch-ua-platform'] = '"Android"';
                } else if (ua.includes('Linux')) {
                    headers['sec-ch-ua-platform'] = '"Linux"';
                } else if (ua.includes('iPhone') || ua.includes('iPad')) {
                    headers['sec-ch-ua-platform'] = '"iOS"';
                }

                return headers;
            } catch (e) {
                console.error('error parsing sec-ch-ua', e);
                return null;
            }
        }

        static parse_hostname(url) {
            if (url) {
                try {
                    return url.replace(/^(.*:)\/\/([A-Za-z0-9\-\.]+)(:[0-9]+)?(.*)$/, '$2').toLowerCase();
                } catch (e) {
                    console.error('error parsing hostname', e);
                }
            }
            return null;
        }

        static match_hostname(url, matches) {
            const hostname = Util.parse_hostname(url);
            if (hostname) {
                for (const e of matches) {
                    if (hostname.includes(e)) return true;
                }
            }
            return false;
        }
    }

    class Cache {
        // Runtime variables cache
        static cache = {};

        // Values, counts, and arrays
        static async set({ tab_id=null, name, value, tab_specific=false }) {
            if (tab_specific) {
                name = `${tab_id}_${name}`;
            }
            this.cache[name] = value;
            return this.cache[name];
        }

        // Values, counts, and arrays
        static async get({ tab_id=null, name, tab_specific=false }) {
            if (tab_specific) {
                name = `${tab_id}_${name}`;
            }
            return this.cache[name];
        }

        // Values, counts, and arrays
        static async remove({ tab_id=null, name, tab_specific=false }) {
            if (tab_specific) {
                name = `${tab_id}_${name}`;
            }
            const value = this.cache[name];
            delete this.cache[name];
            return value;
        }

        // Arrays
        static async append({ tab_id=null, name, value, tab_specific=false }) {
            if (tab_specific) {
                name = `${tab_id}_${name}`;
            }
            if (!(name in this.cache)) {
                this.cache[name] = [];
            }
            this.cache[name].push(value);
            return this.cache[name];
        }

        // Arrays
        static async empty({ tab_id=null, name, tab_specific=false }) {
            if (tab_specific) {
                name = `${tab_id}_${name}`;
            }
            const value = this.cache[name];
            this.cache[name] = [];
            return value;
        }

        // Counts
        static async inc({ tab_id=null, name, tab_specific=false }) {
            if (tab_specific) {
                name = `${tab_id}_${name}`;
            }
            if (!(name in this.cache)) {
                this.cache[name] = 0;
            }
            this.cache[name]++;
            return this.cache[name];
        }

        // Counts
        static async dec({ tab_id=null, name, tab_specific=false }) {
            if (tab_specific) {
                name = `${tab_id}_${name}`;
            }
            if (!(name in this.cache)) {
                this.cache[name] = 0;
            }
            this.cache[name]--;
            return this.cache[name];
        }

        // Counts
        static async zero({ tab_id=null, name, tab_specific=false }) {
            if (tab_specific) {
                name = `${tab_id}_${name}`;
            }
            this.cache[name] = 0;
            return this.cache[name];
        }
    }
    API.register(Cache, 'set');
    API.register(Cache, 'get');
    API.register(Cache, 'remove');
    API.register(Cache, 'append');
    API.register(Cache, 'empty');
    API.register(Cache, 'inc');
    API.register(Cache, 'dec');
    API.register(Cache, 'zero');

    class Net {
        static async fetch({ url, options } = { options: {} }) {
            try {
                const res = await fetch(url, options);
                return await res.text();
            } catch (e) {
                console.error("failed to fetch", url, e)
                return null;
            }
        }
    }
    API.register(Net, 'fetch');

    class Tab {
        static reloads = {};  // tab_id -> { delay, start, timer }

        static _reload({ tab_id }) {
            return new Promise(resolve => chrome.tabs.reload(tab_id, { bypassCache: true }, resolve));
        }

        static async reload({ tab_id, delay = 0, overwrite = true } = {}) {
            // Clear and start timer if overwrite is true or if delay <= remaining time of active timer
            delay = parseInt(delay);
            let remaining = this.reloads[tab_id]?.delay - (Date.now() - this.reloads[tab_id]?.start);
            remaining = (isNaN(remaining) || remaining < 0) ? 0 : remaining;

            if (overwrite || remaining == 0 || delay <= remaining) {
                clearTimeout(this.reloads[tab_id]?.timer);
                this.reloads[tab_id] = {
                    delay: delay,
                    start: Date.now(),
                    timer: setTimeout(() => this._reload({ tab_id }), delay),
                };
                return true;
            }
            return false;
        }

        static close({ tab_id }) {
            return new Promise(resolve => chrome.tabs.remove(tab_id, resolve));
        }

        static open({ url = null } = {}) {
            return new Promise(resolve => chrome.tabs.create({ url }, resolve));
        }

        static navigate({ tab_id, url }) {
            return new Promise(resolve => chrome.tabs.update(tab_id, { url, active: true }, resolve));
        }

        static async navigate_reload({ tab_id, url }) {
            await Tab.navigate({ tab_id, url });
            // await Time.sleep(100);
            // return await new Promise(resolve => chrome.tabs.reload(tab_id, { bypassCache: true }, resolve));
            await Tab.reload({ tab_id, delay: 100 });
        }

        static list() {
            return new Promise(resolve => chrome.tabs.query({}, tabs => resolve(tabs)));
        }

        static active(current = false) {
            return new Promise(resolve => chrome.tabs.query({ active: true, currentWindow: current }, resolve));
        }

        static capture({ quality }) {
            return new Promise(resolve => chrome.tabs.captureVisibleTab({ format: 'jpeg', quality: quality }, resolve));
        }

        static info({ tab_id }) {
            return new Promise(resolve => {
                try {
                    chrome.tabs.get(tab_id, resolve);
                } catch (e) {
                    console.error('error getting tab info', e);
                    resolve(null);
                }
            });
        }

        static async url({ tab_id }) {
            const info = await Tab.info({ tab_id });
            return (info && info.url) ? info.url : null;
        }

        static async hostname({ tab_id }) {
            const url = await Tab.url({ tab_id });
            return Util.parse_hostname(url) ?? 'Unknown Host';
        }
    }
    API.register(Tab, 'reload');
    API.register(Tab, 'close');
    API.register(Tab, 'open');
    API.register(Tab, 'navigate');
    API.register(Tab, 'list');
    API.register(Tab, 'capture');
    API.register(Tab, 'info');
    API.register(Tab, 'url');
    API.register(Tab, 'hostname');

    class Runtime {
        static consume_error(tag) {
            if (chrome.runtime.lastError) {
                console.error('runtime error', tag, chrome.runtime.lastError);
                return true;
            }
            return false;
        }
    }

    class Debugger {
        static VERSION = '1.3';
        static MUTED_EVENTS = ['Debugger.scriptParsed', 'Fetch.requestPaused'];

        static attach({ tab_id }) {
            return new Promise(resolve => {
                chrome.debugger.attach({ tabId: tab_id }, Debugger.VERSION, async () => {
                    resolve(!Runtime.consume_error('debugger attach'));
                });
            });
        }

        static attached() {
            return new Promise(resolve => chrome.debugger.getTargets(targets => {
                resolve(targets.filter(t => t.attached && t.type === 'page' && t.tabId));
            }));
        }

        static detach({ tab_id }) {
            return new Promise(resolve => {
                chrome.debugger.detach({ tabId: tab_id }, () => {
                    resolve(!Runtime.consume_error('debugger detach'));
                });
            });
        }

        static command({ tab_id, method, args = null } = {}) {
            return new Promise(resolve => {
                chrome.debugger.sendCommand({ tabId: tab_id }, method, args, resolve);
            });
        }

        static async enable({ tab_id }) {
            await Debugger.attach({ tab_id });
            await Debugger.command({ tab_id, method: 'Debugger.enable' });
            return !Runtime.consume_error('debugger enable');
        }

        // static {
        //     chrome.debugger.onEvent.addListener((source, method, args) => {
        //         if (Debugger.MUTED_EVENTS.includes(method)) return;
        //         console.log('debugger.onEvent', source, method, args);
        //     });
        //     chrome.debugger.onDetach.addListener((source, reason) => {
        //         console.log('debugger.onDetach', source, reason);
        //     });
        // }

        static Fetch = class Fetch {
            static listeners = {};

            static async enable({ tab_id }) {
                // Block all requests until a callback continues or fulfills them
                await Debugger.enable({ tab_id });
                await Debugger.command({ tab_id, method: 'Fetch.enable', args: {
                    patterns: [
                        { urlPattern: 'http://*' },
                        { urlPattern: 'https://*' },
                    ],
                } });
                return !Runtime.consume_error('debugger fetch enable');
            }

            static async allow_hosts({ tab_id, hosts }) {
                if (Debugger.Fetch.listeners.allow_hosts) {
                    chrome.debugger.onEvent.removeListener(Debugger.Fetch.listeners.allow_hosts);
                }
                Debugger.Fetch.listeners.allow_hosts = async (source, method, args) => {
                    if (method === 'Fetch.requestPaused') {
                        // if (Util.match_hostname(args.request.url, hosts) ||
                        //     args.request.url.startsWith('https://nopecha.com/api/verify')) {
                        if (Util.match_hostname(args.request.url, hosts)) {
                            // console.warn('debugger fetch continue', args.request.url, source.tabId, args.requestId);
                            await Debugger.Fetch._continue({ tab_id: source.tabId, request_id: args.requestId });
                        } else {
                            // console.warn('debugger fetch empty', args.request.url, source.tabId, args.requestId);
                            await Debugger.Fetch._empty({ tab_id: source.tabId, request_id: args.requestId });
                        }
                    }
                };
                chrome.debugger.onEvent.addListener(Debugger.Fetch.listeners.allow_hosts);
                return await Debugger.Fetch.enable({ tab_id });
            }

            static async _continue({ tab_id, request_id }) {
                return await Debugger.command({ tab_id, method: 'Fetch.continueRequest', args: { requestId: request_id } });
            }

            static async _empty({ tab_id, request_id }) {
                return await Debugger.command({ tab_id, method: 'Fetch.fulfillRequest', args: {
                    requestId: request_id,
                    responseCode: 200,
                    responseHeaders: [{ name: 'content-type', value: 'text/html' }],
                    body: btoa(`<html><head></head><body></body></html>`),
                } });
            }
        }
    }
    API.register(Debugger, 'attach');
    API.register(Debugger, 'enable');
    API.register(Debugger, 'detach');
    API.register(Debugger, 'attached');
    API.register(Debugger, 'command');
    API.register(Debugger, 'Fetch.enable');
    API.register(Debugger, 'Fetch.allow_hosts');

    const INJECT_FUNCTIONS = {
        insert_script: function (EXT_ID, API_TYPE, VERBOSE, captcha, sitekey, enterprise, urls) {
            const $script = document.createElement('script');
            $script.type = 'text/javascript';
            if (enterprise && ['recaptcha2_token', 'recaptcha3_token'].includes(captcha)) {
                $script.src = `${urls.enterprise}?render=explicit&hl=en`;
            } else {
                if (captcha === 'recaptcha2_token') {
                    $script.src = urls.recaptcha;
                } else if (captcha === 'recaptcha3_token') {
                    $script.src = `${urls.recaptcha}?render=${sitekey}`;
                } else if (captcha === 'hcaptcha_token') {
                    $script.src = urls.hcaptcha;
                } else if (captcha === 'turnstile_token') {
                    $script.src = urls.turnstile;
                }
            }
            (document.head || document.documentElement).append($script);
        },

        insert_element: function (EXT_ID, API_TYPE, VERBOSE, captcha, sitekey, data, enterprise, i=0) {
            let $e = null;
            if (enterprise || captcha === 'recaptcha3_token') {
                $e = document.createElement('div');
                $e.id = `test_test_${i}`;
            } else {
                if (captcha === 'recaptcha3_token') {
                    $e = document.createElement('button');
                    $e.id = `test_test_${i}`;
                    $e.innerHTML = 'recaptcha3_token';
                    if (data?.action) $e.dataset.action = data.action;
                } else {
                    $e = document.createElement('div');
                    $e.id = `test_test_${i}`;
                }
                $e.dataset.sitekey = sitekey;
                $e.dataset.callback = 'on_solve';
            }
            document.body.append($e);
        },

        insert_callback: function (EXT_ID, API_TYPE, VERBOSE, job_id, captcha, sitekey, data, enterprise, i=0) {
            const $script = document.createElement('script');
            $script.type = 'text/javascript';
            const data_str = data ? JSON.stringify(data) : undefined;

            const LIB = /*javascript*/`
                const EXT_ID = '${EXT_ID}';
                class BG {
                    static exec() {
                        return new Promise(resolve => {
                            try {
                                chrome.runtime.sendMessage(EXT_ID, [...arguments], resolve);
                            } catch (e) {
                                console.error('error in exec', e);
                                new Promise(resolve => setTimeout(resolve, 1000)).then(() => resolve(null));
                            }
                        });
                    }
                }
            `;

            if (enterprise && ['recaptcha2_token', 'recaptcha3_token'].includes(captcha)) {
                $script.innerHTML = /*javascript*/`
                    (() => {
                        ${LIB}

                        const job_id = '${job_id}';
                        const data_str = '${data_str}';
                        let options = {};
                        if (data_str && data_str !== 'undefined') options = JSON.parse(data_str);
                        options.sitekey = '${sitekey}';

                        options.callback = token => {
                            if (${VERBOSE}) console.log('set', token);
                            BG.exec('${API_TYPE}.set', { token });
                        };

                        const interval = setInterval(() => {
                            try {
                                if (grecaptcha && grecaptcha.enterprise && grecaptcha.enterprise.render) {
                                    clearInterval(interval);
                                    grecaptcha?.enterprise?.render('test_test_${i}', options);
                                }
                            } catch (e) {
                                if (${VERBOSE}) console.error('error', e);
                                BG.exec('${API_TYPE}.rate_limited');
                                clearInterval(interval);
                            }
                        }, 3000);
                    })();
                `;
            } else {
                if (captcha === 'recaptcha3_token') {
                    $script.innerHTML = /*javascript*/`
                        (() => {
                            ${LIB}

                            const job_id = '${job_id}';
                            const data_str = '${data_str}';
                            let options = {};
                            if (data_str && data_str !== 'undefined') options = JSON.parse(data_str);

                            let timeout = null;
                            const interval = setInterval(() => {
                                try {
                                    if (grecaptcha && grecaptcha.execute) {
                                        clearTimeout(timeout);
                                        clearInterval(interval);
                                        timeout = setTimeout(() => {
                                            grecaptcha.execute('${sitekey}', options).then(token => {
                                                if (${VERBOSE}) console.log('set', token);
                                                BG.exec('${API_TYPE}.set', { token });
                                            }).catch(e => {
                                                if (${VERBOSE}) console.error('error', e);
                                                BG.exec('${API_TYPE}.rate_limited');
                                            });
                                        }, 2000);
                                    }
                                } catch (e) {
                                    if (${VERBOSE}) console.error('error', e);
                                    BG.exec('${API_TYPE}.rate_limited');
                                } finally {
                                    clearTimeout(timeout);
                                    clearInterval(interval);
                                }
                            }, 3000);
                        })();
                    `;
                } else if (captcha === 'turnstile_token') {
                    $script.innerHTML = /*javascript*/`
                        (() => {
                            ${LIB}

                            const job_id = '${job_id}';
                            const data_str = '${data_str}';
                            let options = {};
                            if (data_str && data_str !== 'undefined') {
                                options = JSON.parse(data_str);
                                if ('cdata' in options) {
                                    options.cData = options.cdata;
                                    delete options.cdata;
                                }
                            }
                            options.sitekey = '${sitekey}';

                            options.callback = token => {
                                if (${VERBOSE}) console.log('set', token);
                                BG.exec('${API_TYPE}.set', { token });
                            };

                            let timeout = null;
                            const interval = setInterval(() => {
                                try {
                                    if (turnstile && turnstile.render) {
                                        clearTimeout(timeout);
                                        clearInterval(interval);
                                        timeout = setTimeout(() => {
                                            turnstile.render(document.querySelector('#test_test_${i}'), options);
                                        }, 2000);
                                    }
                                } catch (e) {
                                    if (${VERBOSE}) console.error('error', e);
                                    BG.exec('${API_TYPE}.rate_limited');
                                    clearInterval(interval);
                                }
                            }, 3000);
                        })();
                    `;
                } else if (captcha === 'recaptcha2_token') {
                    $script.innerHTML = /*javascript*/`
                        (() => {
                            ${LIB}

                            const job_id = '${job_id}';
                            const data_str = '${data_str}';
                            let options = {};
                            if (data_str && data_str !== 'undefined') options = JSON.parse(data_str);

                            window.on_solve = token => {
                                if (${VERBOSE}) console.log('set', token);
                                BG.exec('${API_TYPE}.set', { token });
                            };

                            let timeout = null;
                            const interval = setInterval(() => {
                                try {
                                    if (grecaptcha && grecaptcha.render) {
                                        clearTimeout(timeout);
                                        clearInterval(interval);
                                        timeout = setTimeout(() => {
                                            grecaptcha.render(document.querySelector('#test_test_${i}'), on_solve);
                                        }, 2000);
                                    }
                                } catch (e) {
                                    if (${VERBOSE}) console.error('error', e);
                                    BG.exec('${API_TYPE}.rate_limited');
                                    clearInterval(interval);
                                }
                            }, 3000);
                        })();
                    `;
                } else if (captcha === 'hcaptcha_token' && data_str) {
                    $script.innerHTML = /*javascript*/`
                        (() => {
                            ${LIB}

                            const job_id = '${job_id}';
                            const data_str = '${data_str}';
                            let options = {};
                            if (data_str && data_str !== 'undefined') options = JSON.parse(data_str);

                            window.on_solve = token => {
                                if (${VERBOSE}) console.log('set', token);
                                BG.exec('${API_TYPE}.set', { token });
                            };

                            let timeout = null;
                            const interval = setInterval(() => {
                                try {
                                    if (grecaptcha && grecaptcha.render && grecaptcha.execute) {
                                        clearTimeout(timeout);
                                        clearInterval(interval);
                                        timeout = setTimeout(() => {
                                            grecaptcha.render(document.querySelector('#test_test_${i}'), on_solve);
                                            grecaptcha.execute(options);
                                        }, 1000);
                                    }
                                } catch (e) {
                                    if (${VERBOSE}) console.error('error', e);
                                    BG.exec('${API_TYPE}.rate_limited');
                                    clearInterval(interval);
                                }
                            }, 3000);
                        })();
                    `;
                } else {
                    $script.innerHTML = /*javascript*/`
                        (() => {
                            ${LIB}

                            const job_id = '${job_id}';
                            window.on_solve = token => {
                                if (${VERBOSE}) console.log('set', token);
                                BG.exec('${API_TYPE}.set', { token });
                            };

                            let timeout = null;
                            const interval = setInterval(() => {
                                try {
                                    if (grecaptcha && grecaptcha.render) {
                                        clearTimeout(timeout);
                                        clearInterval(interval);
                                        timeout = setTimeout(() => {
                                            grecaptcha.render(document.querySelector('#test_test_${i}'), on_solve);
                                        }, 1000);
                                    }
                                } catch (e) {
                                    if (${VERBOSE}) console.error('error', e);
                                    BG.exec('${API_TYPE}.rate_limited');
                                    clearInterval(interval);
                                }
                            }, 3000);
                        })();
                    `;
                }
            }
            document.body.append($script);
        },

        remove_popup: function (EXT_ID, API_TYPE, VERBOSE) {
            window.alert = window.location.reload;
            window.onbeforeunload = function() {};
        },

        test: function (EXT_ID, API_TYPE, VERBOSE) {
            const LIB = /*javascript*/`
                const EXT_ID = '${EXT_ID}';
                class BG {
                    static exec() {
                        return new Promise(resolve => {
                            try {
                                chrome.runtime.sendMessage(EXT_ID, [...arguments], resolve);
                            } catch (e) {
                                console.error('error in exec', e);
                                new Promise(resolve => setTimeout(resolve, 1000)).then(() => resolve(null));
                            }
                        });
                    }
                }
            `;

            const CODE = /*javascript*/`
                (async () => {
                    ${LIB}

                    console.log('Test.ping', EXT_ID, await BG.exec('Test.ping', { message: 'hello async!' }));
                    console.log('Test.ping_sync', EXT_ID, await BG.exec('Test.ping_sync', { message: 'hello sync!' }));

                    // chrome.runtime.sendMessage('${EXT_ID}', { hello: 'world' }, response => {
                    //     console.log('extension response', response);
                    // });
                })();
            `;
            const $script = document.createElement('script');
            $script.appendChild(document.createTextNode(CODE));
            (document.head || document.documentElement).appendChild($script);
            $script.parentNode.removeChild($script);
        },
    };

    class Injector {
        static inject({ tab_id, func, args = [] } = {}) {
            console.log('inject', tab_id, func, args);
            const options = {
                target: {
                    tabId: tab_id,
                    allFrames: true,
                },
                world: 'MAIN',
                injectImmediately: true,
                func: INJECT_FUNCTIONS[func],
                args: [EXT_ID, API_TYPE, VERBOSE, ...args],
            };
            return new Promise(resolve => chrome.scripting.executeScript(options, resolve));
        }
    }
    API.register(Injector, 'inject');

    class Proxy {
        static TIMEOUT = 1000 * 60;
        static FETCH_INTERVAL = 1000 * 60 * 10;
        static authorization = null;
        static proxies = null;
        static last_fetch = null;
        static current = null;

        static async get_proxies() {
            let retries = 0;
            const now = Date.now();
            while (Proxy.proxies === null || now - Proxy.last_fetch > Proxy.FETCH_INTERVAL) {
                if (retries++ > 5) {
                    console.error('failed to fetch proxies');
                    break;
                }
                Proxy.last_fetch = now;
                try {
                    const proxies = await fetch('https://jaewan-yun.com/proxies?format=json&key=daisy321').then(r => r.json());
                    Proxy.proxies = [];
                    for (const k of ['B']) {
                        for (const e of proxies[k]) {
                            e['type'] = k;
                            Proxy.proxies.push(e);
                        }
                    }
                    break;
                } catch (e) {
                    console.error('error fetching proxies', e);
                }
                await Time.sleep(5000);
            }
            return Proxy.proxies;
        }

        static async set_random_proxy() {
            const proxies = await Proxy.get_proxies();
            if (!proxies || proxies.length === 0) {
                console.error('no proxies');
                return false;
            }
            const proxy = proxies[Math.floor(Math.random() * proxies.length)];
            console.log('set_random_proxy', proxy);
            return await Proxy.set({ proxy });
        }

        static async set({ proxy }) {
            const pac = {
                scheme: proxy.scheme,
                host: proxy.host,
                port: proxy.port,
                username: proxy.username,
                password: proxy.password,
                data: `function FindProxyForURL(url, host) {
                    if (shExpMatch(host, "*.nopecha.com")) return "DIRECT";
                    if (host == 'nopecha.com' || host == 'jaewan-yun.com') return "DIRECT";
                    return "PROXY ${proxy.host}:${proxy.port}";
                }`,
            };
            return await Proxy.set_pac({ pac });
        }

        static async set_pac({ pac }) {
            console.log('setting pac', pac);
            Proxy.current = pac;

            if (!pac || !pac.scheme || !pac.host || !pac.port) {
                console.error('invalid proxy', pac);
                return false;
            }

            Proxy._clear_credentials();
            if (pac.username && pac.password) Proxy._set_credentials({ username: pac.username, password: pac.password });

            const config = {
                mode: 'pac_script',
                pacScript: {
                    data: pac.data,
                    mandatory: true,
                },
            };
            chrome.proxy.settings.set({ value: config, scope: 'regular' });
            // chrome.proxy.settings.set({ value: config, scope: 'incognito_persistent' });
            return true;
        }

        static _clear_credentials() {
            console.log('clearing credentials');
            chrome.webRequest.onAuthRequired.removeListener(Proxy.authorization);
        }

        static _set_credentials({ username = null, password = null } = {}) {
            Proxy._clear_credentials();
            console.log('setting credentials', username, password);

            if (username && password) {
                Proxy.authorization = (details, callback) => {
                    if (!details.isProxy) {
                        console.error('not a proxy request', details);
                        return callback({});
                    }
                    console.log('proxy authorization', username, password, details);
                    return callback({ authCredentials: { username, password } });
                };
            } else {
                Proxy.authorization = (details, callback) => {
                    if (!details.isProxy) {
                        console.error('not a proxy request', details);
                        return callback({});
                    }
                    // TODO
                    console.error('proxy authorization required but no username/password provided', details);
                    return callback({ cancel: true });
                    // return callback({});
                };
            }
            chrome.webRequest.onAuthRequired.addListener(Proxy.authorization,
                { urls: ['<all_urls>'] },
                ['responseHeaders', 'asyncBlocking', 'extraHeaders']);
            // chrome.webRequest.onAuthRequired.addListener(Proxy.authorization, { urls: ['<all_urls>'] }, ['blocking']);
        }

        static status() {
            return Proxy.current;
        }

        static async clear() {
            console.log('clearing proxy');
            Proxy.current = null;
            Proxy._clear_credentials();
            chrome.proxy.settings.clear({ scope: 'regular' });
            // chrome.proxy.settings.clear({ scope: 'incognito_persistent' });
            return true;
        }
    }
    API.register(Proxy, 'set');
    API.register(Proxy, 'set_pac');
    API.register(Proxy, 'set_random_proxy');
    API.register(Proxy, 'get_proxies');
    API.register(Proxy, 'status');
    API.register(Proxy, 'clear');

    class Cookie {
        static get({ domain } = { domain: undefined }) {
            return new Promise(resolve => {
                chrome.cookies.getAll({ domain }, resolve);
            });
        }

        static async clear({ domain } = { domain: undefined }) {
            if (DEBUG) return;
            const cookies = await Cookie.get({ domain });
            for (let i = 0; i < cookies.length; i++) {
                chrome.cookies.remove({ url: `https://${cookies[i].domain}${cookies[i].path}`, name: cookies[i].name });
            }
        }
    }

    class DNR {
        static modify({ cookie = null, ua = null } = {}) {
            return new Promise(resolve => {
                const addRules = [];
                if (cookie) {
                    addRules.push({
                        'id': addRules.length + 1,
                        'priority': 1,
                        'action': {
                            'type': 'modifyHeaders',
                            'requestHeaders': [
                                {
                                    'header': 'cookie',
                                    'operation': 'set',
                                    'value': cookie,
                                },
                            ],
                        },
                        'condition': {
                            'resourceTypes': ['main_frame', 'sub_frame'],
                        },
                    });
                }
                if (ua) {
                    addRules.push({
                        'id': addRules.length + 1,
                        'priority': 1,
                        'action': {
                            'type': 'modifyHeaders',
                            'requestHeaders': [
                                {
                                    'header': 'user-agent',
                                    'operation': 'set',
                                    'value': ua,
                                },
                            ],
                        },
                        'condition': {
                            'resourceTypes': ['main_frame', 'sub_frame'],
                        },
                    });

                    const headers = Util.generate_sec_ch(ua);
                    if (headers === null) {
                        for (const k of ['sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform']) {
                            addRules.push({
                                'id': addRules.length + 1,
                                'priority': 1,
                                'action': {
                                    'type': 'modifyHeaders',
                                    'requestHeaders': [
                                        {
                                            'header': k,
                                            'operation': 'remove',
                                        },
                                    ],
                                },
                                'condition': {
                                    'resourceTypes': ['main_frame', 'sub_frame'],
                                },
                            });
                        }
                    } else {
                        for (const k of ['sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform']) {
                            addRules.push({
                                'id': addRules.length + 1,
                                'priority': 1,
                                'action': {
                                    'type': 'modifyHeaders',
                                    'requestHeaders': [
                                        {
                                            'header': k,
                                            'operation': 'set',
                                            'value': headers[k],
                                        },
                                    ],
                                },
                                'condition': {
                                    'resourceTypes': ['main_frame', 'sub_frame'],
                                },
                            });
                        }
                    }
                }
                chrome.declarativeNetRequest.updateDynamicRules({
                    addRules,
                    // removeRuleIds: [1, 2, 3, 4, 5],
                    removeRuleIds: Array.from({ length: 50 }, (v, k) => k + 1),
                }, resolve);
            });
        }

        static register_language() {
            browser.declarativeNetRequest.updateDynamicRules({
                addRules: [
                    // Force set language to English for reCAPTCHA
                    {
                        'id': 1,
                        'priority': 1,
                        'action': {
                            'type': 'redirect',
                            'redirect': {
                                'transform': {
                                    'queryTransform': {
                                        'addOrReplaceParams': [
                                            {'key': 'hl', 'value': 'en-US'},
                                        ],
                                    },
                                },
                            },
                        },
                        'condition': {
                            'regexFilter': '^(http|https)://[^\\.]*\\.(google\\.com|recaptcha\\.net)/recaptcha',
                            'resourceTypes': ['sub_frame'],
                        },
                    },
                    // Force set language to English for FunCAPTCHA
                    {
                        'id': 2,
                        'priority': 1,
                        'action': {
                            'type': 'redirect',
                            'redirect': {
                                'transform': {
                                    'queryTransform': {
                                        'addOrReplaceParams': [
                                            {'key': 'lang', 'value': 'en'},
                                        ],
                                    },
                                },
                            },
                        },
                        'condition': {
                            'regexFilter': '^(http|https)://[^\\.]*\\.(funcaptcha\\.(co|com)|arkoselabs\\.(com|cn)|arkose\\.com\\.cn)/fc/gc/',
                            'resourceTypes': ['sub_frame'],
                        },
                    },
                ],
                removeRuleIds: [1, 2],
            });
        }
    }

    class Worker {
        static ID = `token_${Util.generate_id(8)}`;
        static IDLE_URL = 'https://nopecha.com/setup#nopechadaisy';
        static ENDPOINT = 'https://api.nopecha.com/_worker';

        static CAPABILITIES = ['hcaptcha_token', 'recaptcha2_token', 'recaptcha3_token', 'turnstile_token'];

        static work = {};  // tab_id -> { job_id, job, reqs, timer }
        static job = null;
        static result = null;

        static async _get_job() {
            if (DEBUG) {
                const DEMO_JOBS = [
                    // {
                    //     "id": Util.generate_id(8),
                    //     "type": "hcaptcha_token",
                    //     "data": {
                    //         "url": "https://algeria.blsspainvisa.com/book_appointment.php",
                    //         "sitekey": "748d19a1-f537-4b8b-baef-281f70714f56",
                    //         "data": {
                    //             "rqdata":"0Ji4wdKunnOywUKq5nv3KMJ6tqGH9wcWBl0Q0VM8VuvRIqcKk+SwA9vHPPUCePb/PUWD2YIDU/uucUImTNwL48p1YTzzdwTQXN9jg4pJ0e43EqFGSPC1KTdXS3oIu0sY6OBcxZft05er3eqeSSfUNfMZYeo8KIcOUcM7HX6r",
                    //             "rqtoken":"IlpxMis0ZlNHdEJ3ZEZ4bUU4dFo4L3UwUFBQc1JhM1hoTUlDTTcxcGtaZkUxUU5XRzNEblZuL2ZwQ01mNjVRSExORVZxRVE9PXozeW1XYzhaQVBQV3g4dkci.Yk3_qw.t18rr3DCRCYfvQKxRlu73vrTQM8",
                    //         },
                    //         // "enterprise": true,
                    //         "useragent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36",
                    //     },
                    //     "metadata": "hcaptcha_token|algeria.blsspainvisa.com|748d19a1-f537-4b8b-baef-281f70714f56",
                    // },

                    // {
                    //     "id": Util.generate_id(8),
                    //     "type": "hcaptcha_token",
                    //     "data": {
                    //         "url": "https://discord.com",
                    //         "sitekey": "f5561ba9-8f1e-40ca-9b5b-a0b3f719ef34",
                    //     },
                    //     "metadata": "hcaptcha_token|algeria.blsspainvisa.com|748d19a1-f537-4b8b-baef-281f70714f56",
                    // },
                    // {
                    //     "id": Util.generate_id(8),
                    //     "type": "recaptcha2_token",
                    //     "data": {
                    //         "url": "https://gametrade.jp/signin?email_or_number=",
                    //         "sitekey": "6LdBmqYZAAAAALTuNWDI9WSTVFkyAkyCNvc72Ebm",
                    //     },
                    //     "metadata": "recaptcha2_token|gametrade.jp|6LdBmqYZAAAAALTuNWDI9WSTVFkyAkyCNvc72Ebm",
                    // },

                    {
                        "id": Util.generate_id(8),
                        "type": "turnstile_token",
                        "data": {
                            "url": "https://www.modelousa.com/pages/collegefootball/",
                            "sitekey": "0x4AAAAAAAH1-2SHia_B9JCZ"
                        },
                        "metadata": "turnstile_token|0x4AAAAAAAH1-2SHia_B9JCZ",
                    },
                    // {
                    //     "id": Util.generate_id(8),
                    //     "type": "turnstile_token",
                    //     "data": {
                    //         "url": "https://nopecha.com/demo/turnstile",
                    //         "sitekey": "0x4AAAAAAAA-1LUipBaoBpsG",
                    //     },
                    //     "metadata": "turnstile_token|nopecha.com|0x4AAAAAAAA-1LUipBaoBpsG",
                    // },

                    // {
                    //     "id": Util.generate_id(8),
                    //     "type": "recaptcha2_token",
                    //     "data": {
                    //         "url": "https://nopecha.com/demo/recaptcha",
                    //         "sitekey": "6Ld8NA8jAAAAAPJ_ahIPVIMc0C4q58rntFkopFiA",
                    //         "useragent":"testing",
                    //     },
                    //     "metadata": "recaptcha2_token|nopecha.com|6Ld8NA8jAAAAAPJ_ahIPVIMc0C4q58rntFkopFiA",
                    // },
                ];

                // Choose randomly
                const data = DEMO_JOBS[Math.floor(Math.random() * DEMO_JOBS.length)];
                return { job: data, reqs: 0 };
            }

            await Time.sleep(1000);
            try {
                const query = new URLSearchParams({
                    worker_id: Worker.ID,
                    job_types: Worker.CAPABILITIES.join(','),
                    n: '1',
                });
                const url = `${Worker.ENDPOINT}?${query}`;
                const r = await fetch(url).then(r => r.json());
                console.log('Worker._get_job', r);
                if ('error' in r) return null;
                const job = r.data[0];
                return { job, reqs: 0 };
            } catch (e) {
                console.log('error getting job', e);
                await Time.sleep(1000 * 5);
            }
            return null;
        }

        static async _post_job({ tab_id, job_id, token, error, retry }) {
            if (DEBUG) {
                console.warn('_post_job', tab_id, job_id, token, error, retry);
                delete Worker.work[tab_id];
                return true;
            }

            try {
                const job = Worker.work[tab_id].job;
                delete Worker.work[tab_id];
                const data = {
                    worker_id: Worker.ID,
                    job_ids: [job_id],
                    results: [token],
                    error: error,
                    metadata: job,
                    is_token: '1',
                    is_retry: retry ? '1' : '0',
                };
                const r = await fetch(Worker.ENDPOINT, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(data),
                }).then(r => r.json());
                console.log('Jobs._post_job', data, r);
                return true;
            } catch (e) {
                console.log('error posting job', e);
                await Time.sleep(1000 * 10);
            }
            return false;
        }

        static start() {
            Worker.s.on('connect', () => {
                console.log('socket connected');
                Worker.s.emit('ping', Worker.CAPABILITIES, 1);
                Worker._idle();
            });

            Worker.s.on('job', async job => {
                console.log('job', job.id);

                job.reqs = 0;
                Worker.job = job;

                Worker.result = {
                    id: job.id,
                    key: job.key,
                    cls: job.cls,
                    type: job.type,
                    time: Date.now(),  // Calculates local solve duration
                    src: Worker.ID,
                    duration: 0,
                    confidence: 0,
                }

                Worker.s.emit('ack', job.id);
            });

            setInterval(() => {
                if (Worker.job === null && Worker.result === null) {
                    Worker._idle();
                }
            }, 1000 * 30);
        }

        static _idle() {
            Worker.s.emit('idle', Worker.CAPABILITIES, 1);
        }

        static async get({ tab_id }) {
            if (Worker.job) {
                // if (
                //     !Worker.job.sitekey || Worker.job.sitekey.trim() === '' ||
                //     !Worker.job.url || Worker.job.url.trim() === ''
                // ) {
                //     Worker._post_result({ error: 'INVALID SETTINGS' });
                //     await Worker.reset({ tab_id });
                // }

                const dnr = { cookie: null, ua: null };
                if (Worker.job.useragent) dnr.ua = Worker.job.useragent;
                if (Worker.job.cookie) dnr.cookie = Worker.job.cookie;
                await DNR.modify(dnr);

                Worker.job.reqs++;
                if (Worker.job.reqs > 30) {
                    console.log('too many retries. invalidating job', Worker.job);
                    await Worker.invalid({ tab_id });
                }
            }

            chrome.debugger.sendCommand({ tabId: tab_id }, 'Page.setWebLifecycleState', { state: 'active' }, () => {
                console.log(`tab ${tab_id} is now emulated as active`);
            });

            return Worker.job;
        }

        static _post_result({ token, error }) {
            const now = Date.now();
            if (token) Worker.result.data = token;
            if (error) Worker.result.error = error;
            Worker.result.totalDuration = now - Worker.job.time;
            Worker.result.duration = now - Worker.result.time;
            Worker.result.time = now;
            // TODO: retry until success
            const is_error = !!error;
            const is_poolable = true;
            Worker.s.emit('result', Worker.job.key, Worker.job.id, Worker.job.type, is_error, Worker.result, is_poolable);
            console.warn('Worker._post_result', Worker.job.id, Worker.result);
            Worker.job = null;
            Worker.result = null;
            Worker._idle();
        }

        static _post_retry() {
            console.warn('Worker._post_retry', Worker.job.id);
            Worker.s.emit('retry', Worker.job.id);
            Worker.job = null;
            Worker.result = null;
            Worker._idle();
        }

        static async set({ tab_id, job_id, token, error }) {
            console.log('Worker.set', job_id, 'token', token, 'error', error);
            Worker._post_result({ token, error });
            await Worker.reset({ tab_id });
        }

        static async reset({ tab_id }) {
            await DNR.modify({ cookie: null, ua: null });
            await Proxy.clear();
            await Cookie.clear();
            await Time.sleep(1000);
            await Tab.navigate({ tab_id, url: Worker.IDLE_URL });
        }

        static async invalid({ tab_id }) {
            console.log('Worker.invalid', tab_id);
            Worker._post_result({ error: 'INVALID SETTINGS' });
            await Worker.reset({ tab_id });
        }

        static async rate_limited({ tab_id }) {
            console.log('Worker.rate_limited', tab_id);
            Worker._post_retry();
            await Worker.reset({ tab_id });
        }
    }
    API.register(Worker, 'get');
    API.register(Worker, 'set');
    API.register(Worker, 'reset');
    API.register(Worker, 'invalid');
    API.register(Worker, 'rate_limited');
    // Worker.start();

    class Jobs {
        static ID = `token_${Util.generate_id(8)}`;
        static IDLE_URL = 'https://nopecha.com/setup#nopechadaisy';
        static JOB_TYPES = ['hcaptcha_token', 'recaptcha2_token', 'recaptcha3_token', 'turnstile_token'];

        static work = {};  // tab_id -> job
        static verify = {};  // job_id -> type

        static async verify_hcaptcha(token) {
            const r = await fetch('https://nopecha.com/api/verify/hcaptcha', {
                method: 'POST',
                body: JSON.stringify({ token, type: 'publisher' }),
                headers: { 'content-type': 'application/json' },
            }).then(r => r.json());
            return r;
        }

        static async verify_recaptcha(token) {
            const r = await fetch('https://nopecha.com/api/verify/recaptcha', {
                method: 'POST',
                body: JSON.stringify({ token, type: 'hard' }),
                headers: { 'content-type': 'application/json' },
            }).then(r => r.json());
            return r;
        }

        static async verify_turnstile(token) {
            const r = await fetch('https://nopecha.com/api/verify/turnstile', {
                method: 'POST',
                body: JSON.stringify({ token, type: 'nopecha' }),
                headers: { 'content-type': 'application/json' },
            }).then(r => r.json());
            return r;
        }

        static async _get_job() {
            if (DEBUG) {
                const DEMO_JOBS = [
                    {
                        "id": Util.generate_id(8),
                        "type": "hcaptcha_token",
                        "data": {
                            "url": "https://nopecha.com",
                            "sitekey": "b4c45857-0e23-48e6-9017-e28fff99ffb2",
                        },
                        "metadata": "hcaptcha_token|nopecha.com|b4c45857-0e23-48e6-9017-e28fff99ffb2",
                    },

                    {
                        "id": Util.generate_id(8),
                        "type": "recaptcha2_token",
                        "data": {
                            "url": "https://nopecha.com",
                            "sitekey": "6LceNg8jAAAAABkt_mPrc03HfJJNUSy3LvRO6r-P",
                        },
                        "metadata": "recaptcha2_token|nopecha.com|6LceNg8jAAAAABkt_mPrc03HfJJNUSy3LvRO6r-P",
                    },

                    {
                        "id": Util.generate_id(8),
                        "type": "turnstile_token",
                        "data": {
                            "url": "https://nopecha.com",
                            "sitekey": "0x4AAAAAAAA-1LUipBaoBpsG",
                        },
                        "metadata": "turnstile_token|nopecha.com|0x4AAAAAAAA-1LUipBaoBpsG",
                    },

                    // {
                    //     "id": Util.generate_id(8),
                    //     "type": "hcaptcha_token",
                    //     "data": {
                    //         "url": "https://discord.com",
                    //         "sitekey": "f5561ba9-8f1e-40ca-9b5b-a0b3f719ef34",
                    //     },
                    //     "metadata": "hcaptcha_token|algeria.blsspainvisa.com|748d19a1-f537-4b8b-baef-281f70714f56",
                    // },

                    // {
                    //     "id": Util.generate_id(8),
                    //     "type": "recaptcha2_token",
                    //     "data": {
                    //         "url": "https://gametrade.jp/signin?email_or_number=",
                    //         "sitekey": "6LdBmqYZAAAAALTuNWDI9WSTVFkyAkyCNvc72Ebm",
                    //     },
                    //     "metadata": "recaptcha2_token|gametrade.jp|6LdBmqYZAAAAALTuNWDI9WSTVFkyAkyCNvc72Ebm",
                    // },

                    // {
                    //     "id": Util.generate_id(8),
                    //     "type": "turnstile_token",
                    //     "data": {
                    //         "url": "https://www.modelousa.com/pages/collegefootball/",
                    //         "sitekey": "0x4AAAAAAAH1-2SHia_B9JCZ"
                    //     },
                    //     "metadata": "turnstile_token|0x4AAAAAAAH1-2SHia_B9JCZ",
                    // },

                    // {
                    //     "id": Util.generate_id(8),
                    //     "type": "turnstile_token",
                    //     "data": {
                    //         "url": "https://nopecha.com/demo/turnstile",
                    //         "sitekey": "0x4AAAAAAAA-1LUipBaoBpsG",
                    //     },
                    //     "metadata": "turnstile_token|nopecha.com|0x4AAAAAAAA-1LUipBaoBpsG",
                    // },

                    // {
                    //     "id": Util.generate_id(8),
                    //     "type": "recaptcha2_token",
                    //     "data": {
                    //         "url": "https://nopecha.com/demo/recaptcha",
                    //         "sitekey": "6Ld8NA8jAAAAAPJ_ahIPVIMc0C4q58rntFkopFiA",
                    //         "useragent":"testing",
                    //     },
                    //     "metadata": "recaptcha2_token|nopecha.com|6Ld8NA8jAAAAAPJ_ahIPVIMc0C4q58rntFkopFiA",
                    // },
                ];

                // Choose randomly
                const job = DEMO_JOBS[Math.floor(Math.random() * DEMO_JOBS.length)];
                Jobs.verify[job.id] = job.type;
                console.log('Jobs._get_job (DEBUG)', job);
                return { job, reqs: 0, verbose: VERBOSE };
            }

            await Time.sleep(1000);
            try {
                const url = `${ENDPOINT}?worker_id=${Jobs.ID}&job_types=${Jobs.JOB_TYPES.join(',')}&n=1`;
                const r = await fetch(url).then(r => r.json());
                console.log('Jobs._get_job', r);
                if ('error' in r) return null;
                const job = r.data[0];
                return { job, reqs: 0, verbose: VERBOSE };
            } catch (e) {
                console.log('error getting job', e);
                await Time.sleep(1000 * 5);
            }
            return null;
        }

        static async _post_result({ tab_id, job_id, token, error, retry }) {
            if (DEBUG) {
                console.warn('_post_result', tab_id, job_id, token, error, retry);
                delete Jobs.work[tab_id];
                return true;
            }

            try {
                const job = Jobs.work[tab_id].job;
                delete Jobs.work[tab_id];
                const data = {
                    worker_id: Jobs.ID,
                    job_ids: [job_id],
                    results: [token],
                    error: error,
                    metadata: job,
                    is_token: '1',
                    is_retry: retry ? '1' : '0',
                };
                const r = await fetch(ENDPOINT, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(data),
                }).then(r => r.json());
                console.log('Jobs._post_result', data, r);
                return true;
            } catch (e) {
                console.log('error posting job', e);
                await Time.sleep(1000 * 10);
            }
            return false;
        }

        static async get({ tab_id }) {
            last_ping = Date.now();

            let job = null;
            if (tab_id in Jobs.work) {
                job = Jobs.work[tab_id];
                job.reqs++;
                if (job.reqs > 30) {
                    console.warn('too many retries. invalidating job', job);
                    await Jobs.invalid({ tab_id, job_id: job.id });
                }
            } else {
                job = await Jobs._get_job();
                if (job) Jobs.work[tab_id] = job;
            }

            const dnr = { cookie: null, ua: null };
            if (job?.job?.data?.useragent && job?.job?.type !== 'turnstile_token') dnr.ua = job.job.data.useragent;
            if (job?.job?.data?.cookie) dnr.cookie = job.job.data.cookie;
            await DNR.modify(dnr);

            chrome.debugger.sendCommand({ tabId: tab_id }, 'Page.setWebLifecycleState', { state: 'active' }, () => {
                console.log(`tab ${tab_id} is now emulated as active`);
            });

            return job;
        }

        static async set({ tab_id, token, error }) {
            last_ping = Date.now();

            const job_id = Jobs.work[tab_id].job.id;
            console.log('Jobs.set', 'job_id', job_id, 'token', token, 'error', error);
            await Jobs._post_result({ tab_id, job_id, token, error, retry: false });
            await Jobs.reset({ tab_id });

            if (DEBUG) {
                const type = Jobs.verify[job_id];
                if (type === 'recaptcha2_token') console.warn('verify_recaptcha', await Jobs.verify_recaptcha(token));
                else if (type === 'hcaptcha_token') console.warn('verify_hcaptcha', await Jobs.verify_hcaptcha(token));
                else if (type === 'turnstile_token') console.warn('verify_turnstile', await Jobs.verify_turnstile(token));
                else console.error('unknown type', type);
                delete Jobs.verify[job_id];
                return true;
            }

            return true;
        }

        static async reset({ tab_id }) {
            last_ping = Date.now();

            await DNR.modify({ cookie: null, ua: null });
            await Proxy.clear();
            await Time.sleep(1000);
            await Tab.navigate({ tab_id, url: Jobs.IDLE_URL });
            await Cookie.clear();
            return true;
        }

        static async invalid({ tab_id }) {
            last_ping = Date.now();

            const job_id = Jobs.work[tab_id].job.id;
            console.log('Jobs.invalid', job_id);
            await Jobs._post_result({ tab_id, job_id, token: undefined, error: 'INVALID SETTINGS', retry: false });
            await Jobs.reset({ tab_id });
            return true;
        }

        static async rate_limited({ tab_id }) {
            last_ping = Date.now();

            const job_id = Jobs.work[tab_id].job.id;
            console.log('Jobs.rate_limited', job_id);
            await Jobs._post_result({ tab_id, job_id, token: undefined, error: 'RETRY', retry: true });
            await Jobs.reset({ tab_id });
            return true;
        }
    }
    API.register(Jobs, 'get');
    API.register(Jobs, 'set');
    API.register(Jobs, 'reset');
    API.register(Jobs, 'invalid');
    API.register(Jobs, 'rate_limited');

    class Test {
        static async ping({ tab_id, message }) {
            const r = `pong async from ${tab_id} ${message}`;
            console.warn('Test.ping', r);
            return r;
        }

        static ping_sync({ tab_id, message }) {
            const r = `pong sync from ${tab_id} ${message}`;
            console.warn('Test.ping_sync', r);
            return r;
        }
    }
    API.register(Test, 'ping');
    API.register(Test, 'ping_sync');

    (async () => {
        const allow_hosts = [
            'master.nopecha.com',
            'api.nopecha.com',
            'test-api.nopecha.com',
            'jaewan-yun.com',
            'api.ipify.org',
            'google.com',
            'gstatic.com',
            'hcaptcha.com',
            'recaptcha.net',
            'cloudflare.com',
        ];

        // Attach debugger to active tabs at startup
        const tabs = await Tab.active();
        for (const tab of tabs) {
            if (tab.url.startsWith('chrome://')) continue;
            Debugger.Fetch.allow_hosts({ tab_id: tab.id, hosts: allow_hosts });
        }

        // Attach debugger to navigating tabs
        chrome.webNavigation.onBeforeNavigate.addListener(details => {
            Debugger.Fetch.allow_hosts({ tab_id: details.tabId, hosts: allow_hosts });
        });

        // When a network error occurs, try to reset the tab
        chrome.webNavigation.onErrorOccurred.addListener(details => {
            if (details.error === 'net::ERR_ABORTED') return;
            console.log('webNavigation.onErrorOccurred', details);
            Tab.navigate({ tab_id: details.tabId, url: Jobs.IDLE_URL });
        });
    })();

    async function main() {
        API.start();

        await DNR.modify({ cookie: null, ua: null });
        await Cookie.clear();
        await Proxy.clear();
        await Proxy.get_proxies();

        if (!DEBUG) {
            const tabs = await Tab.list();
            if (tabs.length <= 2) {
                for (const tab of tabs) {
                    if (tab.url.startsWith('chrome://') && tabs.length > 1) continue;
                    await Tab.navigate_reload({ tab_id: tab.id, url: Jobs.IDLE_URL });
                }
            }
        }

        await Time.sleep(1000 * 10);

        setInterval(async () => {
            const now = Date.now();
            if (now - last_ping > 1000 * 120) {
                if (VERBOSE) console.log('refreshing');
                const tabs = await Tab.list();
                if (tabs.length <= 2) {
                    for (const tab of tabs) {
                        if (tab.url.startsWith('chrome://') && tabs.length > 1) continue;
                        await Tab.navigate_reload({ tab_id: tab.id, url: Jobs.IDLE_URL });
                    }
                }
                last_ping = now;
            }
        }, 1000 * 10);

        // chrome.runtime.onMessageExternal.addListener(function(request, sender, sendResponse) {
        //     console.log(request, request.hello);
        //     sendResponse('OK!');
        // });
        // Injector.inject({ func: 'test' });

        // await DNR.modify({
        //     // cookie: 'test cookie',
        //     // ua: 'Opera/9.80 (J2ME/MIDP; Opera Mini/9.80 (S60; SymbOS; Opera Mobi/23.348; U; en) Presto/2.5.25 Version/10.54',
        //     // ua: 'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/119.0',
        //     // ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
        //     // ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36',
        // });

        // const tabs = await Tab.list();
        // for (const tab of tabs) {
        //     if (tab.url.startsWith('chrome://') && tabs.length > 1) continue;
        //     if (tab.url === 'https://developer.chrome.com/docs/extensions/reference/debugger/#examples') {
        //         console.log('attaching debugger', tab);
        //         await Debugger.attach({ tab_id: tab.id });
        //         await Debugger.attach({ tab_id: tab.id });
        //         break;
        //     }
        // }
        // const attached = await Debugger.attached();
        // console.log('attached', attached);
    }

    main();
})();