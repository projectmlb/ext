(() => {
    let EXT_ID = null;
    let API_TYPE = null;
    let DEBUG = null;
    let VERBOSE = null;
    let URLS = null;
    let TIMEOUTS = null;

    class BG {
        static exec() {
            return new Promise(resolve => {
                try {
                    // console.log('exec', arguments);
                    chrome.runtime.sendMessage([...arguments], resolve);
                } catch (e) {
                    // console.log('exec failed', e);
                    sleep(1000).then(() => {
                        resolve(null);
                    });
                }
            });
        }
    }

    function sleep(t) {
        return new Promise(resolve => setTimeout(resolve, t));
    }

    function is_rate_limited() {
        const $fail = document.querySelector('#fail');
        if (!$fail) return false;
        return $fail.style.display !== 'none';
    }

    function is_timeout(start, timeout = 60) {
        if (Date.now() - start > 1000 * timeout) return true;
        return false;
    }

    (async () => {
        const config = await BG.exec('Config.get');
        EXT_ID = config.EXT_ID;
        API_TYPE = config.API_TYPE;
        DEBUG = config.DEBUG;
        VERBOSE = config.VERBOSE;
        URLS = config.URLS;
        TIMEOUTS = config.TIMEOUTS;

        await sleep(1000 * 10);

        const start = Date.now();
        while (true) {
            await sleep(1000);
            if (is_rate_limited()) {
                const r = await BG.exec('Jobs.get');
                VERBOSE && console.error('turnstile rate limited', JSON.stringify(r));
                await BG.exec('Jobs.rate_limited', { job_id: r.job.id });
            } else if (is_timeout(start, TIMEOUTS.turnstile)) {
                const r = await BG.exec('Jobs.get');
                VERBOSE && console.error('turnstile timeout error', JSON.stringify(r));
                await BG.exec('Jobs.rate_limited', { job_id: r.job.id });
            }
        }
    })();

    class Debugger {
        static locations = {};
        static sources = {};

        static async attach() {
            return await BG.exec('Debugger.attach');
        }

        static async detach() {
            return await BG.exec('Debugger.detach');
        }

        static async command(method, params) {
            return await BG.exec('Debugger.command', {method, params});
        }

        static locate($e) {
            const {left, top, width, height} = $e.getBoundingClientRect();
            const p = {x: Math.ceil(left + width/2), y: Math.ceil(top + height/2)};

            const id = Util.generate_id(8);

            window.parent.postMessage({nopecha_debugger: id, action: 'locate_request', p}, '*');

            // Wait for a response
            return new Promise(resolve => {
                function check() {
                    if (Debugger.locations[id]) {
                        const location = Debugger.locations[id];
                        delete Debugger.locations[id];
                        delete Debugger.sources[id];
                        return resolve(location);
                    }
                    setTimeout(() => requestAnimationFrame(check), 100);
                }
                requestAnimationFrame(check);
            });
        }

        static async click(x, y, button='left') {
            await Debugger.command('Input.dispatchMouseEvent', {type: 'mousePressed', clickCount: 1, button, x, y});
            await sleep(Math.random() * 100 + 50);
            await Debugger.command('Input.dispatchMouseEvent', {type: 'mouseReleased', clickCount: 1, button, x, y});
        }

        static async click_element($e, button='left') {
            const {x, y} = await Debugger.locate($e);
            await Debugger.click(x, y, button);
        }

        static listen() {
            const event_method = window.addEventListener ? 'addEventListener' : 'attachEvent';
            const message_event = event_method == 'attachEvent' ? 'onmessage' : 'message';
            window[event_method](message_event, async e => {
                const key = e.message ? 'message' : 'data';
                const data = e[key];
                if (!data || !data.nopecha_debugger) {
                    return;
                }
                const id = data.nopecha_debugger;

                if (data.action === 'locate_request') {
                    // Remember where the request came from to send response back
                    Debugger.sources[id] = e.source;

                    // Accumulate position on the way up
                    let $frame;
                    for (const $e of document.querySelectorAll('iframe')) {
                        if ($e.contentWindow === e.source) {
                            $frame = $e;
                            break;
                        }
                    }
                    const {left, top} = $frame.getBoundingClientRect();
                    data.p.x += left;
                    data.p.y += top;

                    if (Location.subframe()) {
                        return window.parent.postMessage(data, '*');
                    }

                    // Make a u turn to message origin
                    data.action = 'locate_response';
                    e.source.postMessage(data, '*');
                }
                else if (data.action === 'locate_response') {
                    if (Debugger.sources[id]) {
                        return Debugger.sources[id].postMessage(data, '*');
                    }
                    // Message origin received location
                    Debugger.locations[id] = data.p;
                }
            }, false);
        }
    }
    // Debugger.listen();

    (async () => {
        // // Get absolute click location
        // document.body.addEventListener('click', e => {
        //     const {left, top} = e.target.getBoundingClientRect();
        //     const p = {x: Math.ceil(left + e.offsetX), y: Math.ceil(top + e.offsetY)};
        //     console.log(p);
        // });

        // await Debugger.attach();
        while (true) {
            await sleep(Math.random() * 5000 + 5000);
            await Debugger.click(Math.random() * (window.innerWidth-100) + 50, Math.random() * (window.innerHeight-100) + 50);
            await sleep(500);
            await Debugger.click(Math.random() * (window.innerWidth-100) + 50, Math.random() * (window.innerHeight-100) + 50);
        }
    })();
})();
