// (async () => {
//     function set_ua(ua) {
//         if (!ua) {
//             return;
//         }

//         const PLATFORMS = {
//             'Windows': 'Win32',
//             'Macintosh': 'MacIntel',
//             'Linux': 'Linux x86_64',
//         };
//         let platform = 'Win32';
//         for (const p in PLATFORMS) {
//             if (ua.includes(p)) {
//                 platform = PLATFORMS[p];
//                 break;
//             }
//         }

//         const app_version = ua.replace('Mozilla/', '');

//         const VENDORS = {
//             'Chrome': 'Google Inc.',
//             'Firefox': 'Mozilla',
//             'Safari': 'Apple Computer, Inc.',
//             'Opera': 'Opera Software ASA',
//             'Edge': 'Microsoft Corporation',
//         };
//         let vendor = 'Google Inc.';
//         for (const v in VENDORS) {
//             if (ua.includes(v)) {
//                 vendor = VENDORS[v];
//                 break;
//             }
//         }

//         const CODE = `
//             (() => {
//                 if (navigator.__defineGetter__) {
//                     navigator.__defineGetter__('userAgent',() => '${ua}');
//                     navigator.__defineGetter__('platform',() => '${platform}');
//                     navigator.__defineGetter__('appVersion',() => '${app_version}');
//                     navigator.__defineGetter__('vendor',() => '${vendor}');
//                 } else {
//                     // Object.defineProperty(navigator, 'userAgent', {
//                     //     get: () => '${ua}',
//                     // });
//                     // Object.defineProperty(navigator, 'platform', {
//                     //     get: () => '${platform}',
//                     // });
//                     // Object.defineProperty(navigator, 'appVersion', {
//                     //     get: () => '${app_version}',
//                     // });
//                     // Object.defineProperty(navigator, 'vendor', {
//                     //     get: () => '${vendor}',
//                     // });
//                 }
//             })();
//         `;
//         const $script = document.createElement('script');
//         $script.appendChild(document.createTextNode(CODE));
//         (document.head || document.documentElement).appendChild($script);
//         $script.parentNode.removeChild($script);
//     }

//     // const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36';
//     // const job = await BG.exec('Jobs.get');
//     // if (job?.job?.data?.useragent) {
//     //     set_ua(job.job.data.useragent);
//     // }
//     const ua = await BG.exec('UA.get');
//     if (ua) {
//         console.log('setting ua', ua);
//         set_ua(ua);
//     }
// })();
