// // console.log('content.js', window.location.href);

// class BG {
//     static exec() {
//         return new Promise(resolve => {
//             try {
//                 // console.log('exec', arguments);
//                 chrome.runtime.sendMessage([...arguments], resolve);
//             } catch (e) {
//                 // console.log('exec failed', e);
//                 sleep(1000).then(() => {
//                     resolve(null);
//                 });
//             }
//         });
//     }
// }

// function sleep(t) {
//     return new Promise(resolve => setTimeout(resolve, t));
// }

// async function myip() {
//     return await fetch('https://api.ipify.org?format=json').then(r => r.json()).then(r => r.ip);
// }
