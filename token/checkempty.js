// (async () => {
//     const VERBOSE = false;

//     // Wait to load the page
//     document.addEventListener('DOMContentLoaded', async () => {
//         await sleep(1000 * 3);

//         while (true) {
//             await sleep(1000);

//             if (window.location.href.includes('nopecha.com/setup')) return;

//             // Check if html is empty
//             // if (document.head.innerHTML === '') {
//             //     console.log('head is empty');
//             //     await sleep(1000 * 10);
//             //     await BG.exec('Jobs.invalid', {job_id: r.job.id});
//             //     // await BG.exec('Jobs.reset');
//             //     return;
//             // }
//             if (document.body.innerHTML === '') {
//                 // alert('body is empty');

//                 const r = await BG.exec('Jobs.get');
//                 VERBOSE && console.log('empty body', JSON.stringify(r));
//                 await sleep(1000 * 10);
//                 await BG.exec('Jobs.rate_limited', { job_id: r.job.id });
//                 // await BG.exec('Jobs.invalid', {job_id: r.job.id});
//                 return;
//             }
//         }
//     });
// })();
