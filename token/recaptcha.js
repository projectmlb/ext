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

    function is_invalid_config() {
        return document.querySelector('.rc-anchor-error-message') !== null;
    }

    function is_rate_limited() {
        return document.querySelector('.rc-doscaptcha-header') !== null;
    }

    function is_connection_error() {
        return document.querySelector('.fbc-message.fbc-main-message') !== null;
    }

    function is_empty_payload() {
        return document.querySelector('.rc-imageselect-payload')?.innerHTML === '';
    }

    function is_timeout(start, timeout = 60) {
        if (Date.now() - start > 1000 * timeout) return true;
        return false;
    }

    BG.exec('Injector.inject', { func: 'remove_popup' });

    (async () =>  {
        while (true) {
            await sleep(1000);

            const payload_empty = await BG.exec('Cache.get', { name: 'payload_empty' });
            if (payload_empty) {
                VERBOSE && console.error('payload_empty', payload_empty);
                // Open the image frame
                const $checkbox = document.querySelector('#recaptcha-anchor');
                if ($checkbox) {
                    VERBOSE && console.warn('clicking checkbox');
                    $checkbox.click();
                    await BG.exec('Cache.set', { name: 'payload_empty', value: false });
                    await sleep(3000);
                }
            }
        }
    })();

    (async () => {
        const config = await BG.exec('Config.get');
        EXT_ID = config.EXT_ID;
        API_TYPE = config.API_TYPE;
        DEBUG = config.DEBUG;
        VERBOSE = config.VERBOSE;
        URLS = config.URLS;
        TIMEOUTS = config.TIMEOUTS;

        await sleep(1000 * 30);

        const start = Date.now();
        while (true) {
            await sleep(1000);
            if (is_invalid_config()) {
                const r = await BG.exec('Jobs.get');
                VERBOSE && console.error('recaptcha invalid', JSON.stringify(r));
                await BG.exec('Jobs.invalid', { job_id: r.job.id });
            } else if (is_rate_limited()) {
                const r = await BG.exec('Jobs.get');
                VERBOSE && console.error('recaptcha rate limited', JSON.stringify(r));
                await BG.exec('Jobs.rate_limited', { job_id: r.job.id });
            } else if (is_connection_error()) {
                const r = await BG.exec('Jobs.get');
                VERBOSE && console.error('recaptcha connection error', JSON.stringify(r));
                await BG.exec('Jobs.rate_limited', { job_id: r.job.id });
            } else if (is_timeout(start, TIMEOUTS.recaptcha)) {
                const r = await BG.exec('Jobs.get');
                VERBOSE && console.error('recaptcha timeout error', JSON.stringify(r));
                await BG.exec('Jobs.rate_limited', { job_id: r.job.id });
            } else if (is_empty_payload()) {
                VERBOSE && console.error('recaptcha empty payload');
                await BG.exec('Cache.set', { name: 'payload_empty', value: true });
            }
        }
    })();
})();
