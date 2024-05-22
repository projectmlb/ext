(() => {
    let EXT_ID = null;
    let API_TYPE = null;
    let DEBUG = null;
    let VERBOSE = null;
    let URLS = null;

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

    async function insert_captcha(job_id, captcha, sitekey, data, enterprise, i=0) {
        VERBOSE && console.log('captcha', captcha, 'sitekey', sitekey, 'data', data, 'enterprise', enterprise, 'trial number', i);
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
        const config = await BG.exec('Config.get');
        EXT_ID = config.EXT_ID;
        API_TYPE = config.API_TYPE;
        DEBUG = config.DEBUG;
        VERBOSE = config.VERBOSE;
        URLS = config.URLS;
        VERBOSE && console.log('config', config);

        await sleep(3000);

        let job_id = null;

        while (true) {
            const r = await BG.exec(`${API_TYPE}.get`);
            if (!r) {
                await sleep(1000);
                continue;
            }

            const { job } = r;
            VERBOSE && console.log(`${API_TYPE}.get`, job);
            job_id = job.id;

            // Refresh on timeout to prevent getting stuck
            setTimeout(async () => {
                VERBOSE && console.error('timeout');
                await BG.exec(`${API_TYPE}.rate_limited`);
                await BG.exec(`${API_TYPE}.reset`);
            }, 1000 * 180);

            if (!window.location.href.includes('nopecha.com/setup') && is_in_target(job.data.url)) {
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
                            VERBOSE && console.error('user proxy failed to set');
                            // TODO
                        }
                        if (!status.ip) {
                            VERBOSE && console.error('proxy timeout');
                            await BG.exec(`${API_TYPE}.rate_limited`);
                            await BG.exec(`${API_TYPE}.reset`);
                            return;
                        }
                    }
                } else {
                    if (await BG.exec('Proxy.set_random_proxy')) {
                        status = await BG.exec('Proxy.status');
                        status.ip = await myip();
                    } else {
                        VERBOSE && console.error('personal proxy failed to set');
                        // TODO
                    }
                    VERBOSE && console.log('no proxies provided. connected to personal proxy', status);
                    if (!status.ip) {
                        VERBOSE && console.error('personal proxy timeout');
                        await BG.exec(`${API_TYPE}.rate_limited`);
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
            } else {
                VERBOSE && console.log(`navigate to target ${window.location.href} -> ${job.data.url}`);
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
