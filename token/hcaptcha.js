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
        // The sitekey for this hCaptcha is incorrect. Please contact the site admin if you see this.
        // const warning = document.querySelector('#warning')?.innerHTML;
        const warning = document.querySelector('.warning-text > span')?.innerHTML;
        return warning && warning.length > 0;
        // if (warning && warning.length > 0) {
        //     console.error('invalid config', warning);
        //     // invalid config <div class="warning-text"></div>
        //     return true;
        // }
        // return false;
    }

    function is_rate_limited() {
        if (document.querySelector('[aria-label="Rate limited or network error. Please retry."]')) {
            return true;
        }
        return false;
        // const status = document.querySelector('#status')?.innerHTML;
        // return status && status.length > 0;
    }

    function is_banned() {
        const status = document.querySelector('#status')?.innerHTML;
        return status === "Account banned, service suspended";
        // return false;
    }

    function is_timeout(start, timeout = 60) {
        if (Date.now() - start > 1000 * timeout) return true;
        return false;
    }

    (async () => {
        await sleep(1000 * 10);

        while (true) {
            await sleep(1000);

            // if (is_invalid_config()) {
            //     const r = await BG.exec('Jobs.get');
            //     console.error('hcaptcha invalid', JSON.stringify(r));
            //     // await BG.exec('Jobs.invalid', { job_id: r.job.id });
            //     await BG.exec('Jobs.rate_limited', { job_id: r.job.id });
            // }
            if (is_rate_limited()) {
                const r = await BG.exec('Jobs.get');
                VERBOSE && console.error('hcaptcha rate limited', JSON.stringify(r));
                await BG.exec('Jobs.rate_limited', { job_id: r.job.id });
            }
        }
    })();

    // Starts instantly
    (async () => {
        const config = await BG.exec('Config.get');
        EXT_ID = config.EXT_ID;
        API_TYPE = config.API_TYPE;
        DEBUG = config.DEBUG;
        VERBOSE = config.VERBOSE;
        URLS = config.URLS;
        TIMEOUTS = config.TIMEOUTS;

        const start = Date.now();
        while (true) {
            await sleep(1000);
            if (is_invalid_config()) {
                const r = await BG.exec('Jobs.get');
                VERBOSE && console.error('hcaptcha invalid', JSON.stringify(r));
                await BG.exec('Jobs.invalid', { job_id: r.job.id });
            } else if (is_rate_limited()) {
                const r = await BG.exec('Jobs.get');
                VERBOSE && console.error('hcaptcha rate limited', JSON.stringify(r));
                await BG.exec('Jobs.rate_limited', { job_id: r.job.id });
            } else if (is_banned()) {
                const r = await BG.exec('Jobs.get');
                VERBOSE && console.error('hcaptcha accont banned', JSON.stringify(r));
                await BG.exec('Jobs.rate_limited', { job_id: r.job.id });
            } else if (is_timeout(start, TIMEOUTS.hcaptcha)) {
                const r = await BG.exec('Jobs.get');
                VERBOSE && console.error('hcaptcha timeout error', JSON.stringify(r));
                await BG.exec('Jobs.rate_limited', { job_id: r.job.id });
            }
        }
    })();
})();
