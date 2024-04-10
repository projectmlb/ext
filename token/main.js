(() => {
    const VERBOSE = false;

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

    async function myip() {
        return await fetch('https://api.ipify.org?format=json').then(r => r.json()).then(r => r.ip);
    }

    const URLS = {
        recaptcha: 'https://www.google.com/recaptcha/api.js',
        enterprise: 'https://recaptcha.net/recaptcha/enterprise.js',
        hcaptcha: 'https://js.hcaptcha.com/1/api.js',
        turnstile: 'https://challenges.cloudflare.com/turnstile/v0/api.js',
    };

    async function insert_captcha(job_id, captcha, sitekey, data, enterprise, i=0) {
        VERBOSE && console.log('captcha', captcha, 'sitekey', sitekey, 'data', data, 'enterprise', enterprise, 'i', i);
        // insert_script(captcha, sitekey, enterprise);
        // insert_element(captcha, sitekey, data, enterprise, i);
        // insert_callback(captcha, sitekey, data, enterprise, i);
        await BG.exec('Injector.inject', { func: 'insert_script', args: [captcha, sitekey, enterprise, URLS] });
        await BG.exec('Injector.inject', { func: 'insert_element', args: [captcha, sitekey, data, enterprise, i] });
        await BG.exec('Injector.inject', { func: 'insert_callback', args: [job_id, captcha, sitekey, data, enterprise, i] });
    }

    function is_in_target(target) {
        target = target.toLowerCase();
        const host = window.location.host.toLowerCase();
        return target.includes(host);
    }

    async function start() {
        // const allow_hosts = [
        //     'api.nopecha.com',
        //     'dev-api.nopecha.com',
        //     'jaewan-yun.com',
        //     'api.ipify.org',
        //     // Captcha providers
        //     'google.com',
        //     'gstatic.com',
        //     'hcaptcha.com',
        //     'recaptcha.net',
        //     'cloudflare.com',
        // ];

        // await BG.exec('Debugger.Fetch.allow_hosts', { hosts: allow_hosts });

        await sleep(3000);

        let job_id = null;

        // window.addEventListener('message', async e => {
        //     if (job_id === null) {
        //         console.error('job_id is null', job_id, e);
        //         await BG.exec('Jobs.set', { job_id, error: 'UNKNOWN TOKEN ERROR' });
        //         await BG.exec('Jobs.reset');
        //     }
        //     else if (e.data.event === 'NOPECHA_TOKEN') {
        //         VERBOSE && console.log('NOPECHA_TOKEN', e.data.token);
        //         await BG.exec('Jobs.set', { job_id, token: e.data.token });
        //         await BG.exec('Jobs.reset');
        //     }
        //     else if (e.data.event === 'NOPECHA_ERROR') {
        //         VERBOSE && console.log('NOPECHA_ERROR', e.data.error);
        //         // await BG.exec('Jobs.set', {job_id, error: e.data.error});
        //         // await BG.exec('Jobs.reset');
        //         await BG.exec('Jobs.rate_limited', { job_id });
        //         await BG.exec('Jobs.reset');
        //     }
        // });

        while (true) {
            const r = await BG.exec('Jobs.get');
            if (r === null) {
                await sleep(1000);
                continue;
            }
            const job = r.job;
            VERBOSE && console.log('Jobs.get', job);
            job_id = job.id;

            if (job.retries > 30) {
                await BG.exec('Jobs.set', { job_id, error: 'MAX RETRIES' });
                await BG.exec('Jobs.reset');
                continue;
            }

            // await BG.exec('Jobs.set', {job_id, token: 'testing'});
            // continue;

            // Refresh on timeout to prevent getting stuck
            setTimeout(async () => {
                // await BG.exec('Jobs.set', {job_id, error: 'SOLVE TIMEOUT'});
                await BG.exec('Jobs.rate_limited', { job_id });
                await BG.exec('Jobs.reset');
            }, 1000 * 180);

            if (!window.location.href.includes('nopecha.com/setup') && is_in_target(job.data.url)) {
                // Check that sitekey exists
                const sitekey = job.data.sitekey;
                if (!sitekey || sitekey.trim() === '') {
                    await BG.exec('Jobs.set', { job_id, error: 'INVALID SETTINGS' });
                    await BG.exec('Jobs.reset');
                    return;
                }

                let status = {
                    ip: null,
                    scheme: null,
                    host: null,
                    port: null,
                    username: null,
                    password: null,
                };
                if (job.data.proxy) {
                    VERBOSE && console.log('setting proxy', job.data.proxy);
                    if (job.data.proxy.scheme && job.data.proxy.host && job.data.proxy.port) {
                        if (await BG.exec('Proxy.set', { proxy: job.data.proxy })) {
                            status = await BG.exec('Proxy.status');
                            status.ip = await myip();
                        } else {
                            console.error('user proxy failed to set');
                            // TODO
                        }
                        if (!status.ip) {
                            // await BG.exec('Jobs.set', {job_id, error: 'PROXY TIMEOUT'});
                            await BG.exec('Jobs.rate_limited', { job_id });
                            await BG.exec('Jobs.reset');
                            return;
                        }
                    }
                } else {
                    if (await BG.exec('Proxy.set_random_proxy')) {
                        status = await BG.exec('Proxy.status');
                        status.ip = await myip();
                    } else {
                        console.error('personal proxy failed to set');
                        // TODO
                    }
                    VERBOSE && console.log('no proxies provided. connected to personal proxy', status);
                    if (!status.ip) {
                        await BG.exec('Jobs.rate_limited', { job_id });
                        return;
                    }
                }

                const $e = document.createElement('div');
                $e.innerHTML = `
                    <div style='font-size: 10px; font-weight: bold;'>
                        <div style='display: flex; flex-direction: row; flex-wrap: nowrap;'>
                            <div>${status.ip}</div>
                        </div>
                        <div style='display: flex; flex-direction: row; flex-wrap: nowrap;'>
                            <div>${status.scheme}://${status.username}:${status.password}@${status.host}:${status.port}</div>
                        </div>
                    </div>
                    <hr>
                `;
                document.body.prepend($e);

                insert_captcha(job_id, job.type.replace('_dev', ''), job.data.sitekey, job.data.data, job.data.enterprise);
            }
            else {
                VERBOSE && console.log(`navigate to target ${window.location.href} -> ${job.data.url}`);
                // await BG.exec('Debugger.Fetch.allow_hosts', { hosts: allow_hosts });
                window.location.href = job.data.url;
            }
            break;
        }
    }

    window.addEventListener('load', start);

    // const allow_hosts = [
    //     'www.nopecha.com',
    //     'api.nopecha.com',
    //     'dev-api.nopecha.com',
    //     'jaewan-yun.com',
    //     'api.ipify.org',
    //     // Captcha providers
    //     'google.com',
    //     'gstatic.com',
    //     'hcaptcha.com',
    //     'recaptcha.net',
    //     'cloudflare.com',
    //     // Test sites
    //     'david-fong.github.io',
    //     'www.nfe.fazenda.gov.br',
    // ];
    // BG.exec('Debugger.Fetch.allow_hosts', { hosts: allow_hosts });
    // BG.exec('Injector.inject', { func: 'test' });
})();
