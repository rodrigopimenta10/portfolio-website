// Counts one page view, without a cookie or an identifier: one request that carries this page's
// path, which the status service writes to its log (status/src/portfolio_status/app.py).
//
// Not sent when the browser asks not to be tracked (Do Not Track or Global Privacy Control), from
// an automated browser, or on a developer's machine.
const browser = navigator as Navigator & { globalPrivacyControl?: boolean };
const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

if (!local && !browser.webdriver && browser.doNotTrack !== '1' && browser.globalPrivacyControl !== true) {
  browser.sendBeacon?.(`/api/hit?path=${encodeURIComponent(location.pathname)}`);
}
