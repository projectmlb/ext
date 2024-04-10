// function remove_fingerprint() {
//     try {
//         const CODE = `
// (() => {
//     console.log('removing fingerprint');
//     window.alert = window.location.reload;
//     window.onbeforeunload = function() {};
//     let a = window;
//     let b = [];
//     while (a !== null) {
//         b = b.concat(Object.getOwnPropertyNames(a));
//         a = Object.getPrototypeOf(a);
//     }
//     b.forEach(p => p.match(/.+_.+_(Array|Promise|Symbol)/ig) && delete window[p]);
//     Object.defineProperty(window, 'navigator', {
//         value: new Proxy(navigator, {
//             has: (target, key) => (key === 'webdriver' ? false : key in target),
//             get: (target, key) => key === 'webdriver' ? false : typeof target[key] === 'function' ? target[key].bind(target) : target[key],
//         })
//     });
// })();
//         `;
//         const $script = document.createElement('script');
//         $script.appendChild(document.createTextNode(CODE));
//         (document.head || document.documentElement).appendChild($script);
//         $script.parentNode.removeChild($script);
//     } catch (e) {
//         console.log('error injecting');
//     }
// }

// remove_fingerprint();
// setTimeout(remove_fingerprint, 0);
