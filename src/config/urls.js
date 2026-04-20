// External URLs that the kiosk renders inside the content area.
// If a site sends X-Frame-Options / CSP that blocks iframes, we
// automatically re-fetch it through a CORS proxy and render the
// rewritten HTML via <iframe srcdoc>.
export const URL_CONFIG = {
  website: 'https://www.csun.edu/career',
  partners: 'https://w2.csun.edu/career/recruit-matadors/our-employer-partners',
  // Ordered list of CORS proxies to try. Each must return the raw
  // body of the requested URL and send Access-Control-Allow-Origin: *.
  corsProxies: [
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    (u) => `https://thingproxy.freeboard.io/fetch/${u}`,
  ],
};
