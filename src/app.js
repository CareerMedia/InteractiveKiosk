import { EVENT_CONFIG } from './config/event.js';
import { LOGO_CONFIG } from './config/logos.js';
import { MAP_CONFIG } from './config/map.js';
import { POPUP_CONFIG } from './config/popup.js';
import { TIMING_CONFIG } from './config/timing.js';
import { URL_CONFIG } from './config/urls.js';

// ─── STATE ────────────────────────────────────────────────
const state = {
  activeView: 'home',    // 'home' | 'map' | 'website' | 'info' | 'partners'
  inactivityTimer: null,
  countdownTimer: null,
  popupTimer: null,
  popupAutoCloseTimer: null,
  sessionPopupShown: false,
  attendeeLogos: [],
  partnerLogos: [],
  eventsLoaded: false,
  mapLoaded: false,
  webLoadState: { website: 'idle', partners: 'idle' },
};

// ─── ELEMENT CACHE ───────────────────────────────────────
const els = {
  app:                document.getElementById('app'),
  eventLabelPill:     document.getElementById('event-label-pill'),
  eventDate:          document.getElementById('event-date'),
  ctaText:            document.getElementById('cta-text'),
  countdownPill:      document.getElementById('countdown-pill'),
  ctaBar:             document.getElementById('cta-bar'),

  // Home view content
  partnerLogosRow:    document.getElementById('partner-logos-row'),
  logoTickerTrack:    document.getElementById('logo-ticker-track'),

  // Views
  viewHome:           document.getElementById('view-home'),
  viewMap:            document.getElementById('view-map'),
  viewWebsite:        document.getElementById('view-website'),
  viewInfo:           document.getElementById('view-info'),
  viewPartners:       document.getElementById('view-partners'),

  // Map
  mappedinFrame:      document.getElementById('mappedin-frame'),

  // Website view
  websiteFrame:       document.getElementById('website-frame'),
  webLoading:         document.getElementById('web-loading'),
  webLoadingText:     document.getElementById('web-loading-text'),
  webFallback:        document.getElementById('web-fallback'),
  webFallbackText:    document.getElementById('web-fallback-text'),
  webFallbackUrl:     document.getElementById('web-fallback-url'),
  webUrl:             document.getElementById('web-url'),
  webOpenExternal:    document.getElementById('web-open-external'),

  // Partners view
  partnersFrame:      document.getElementById('partners-frame'),
  partnersLoading:    document.getElementById('partners-loading'),
  partnersFallback:   document.getElementById('partners-fallback'),
  partnersFallbackUrl:document.getElementById('partners-fallback-url'),
  partnersUrl:        document.getElementById('partners-url'),
  partnersOpenExternal:document.getElementById('partners-open-external'),

  // Info (events)
  eventsGrid:         document.getElementById('events-grid'),
  eventsLoading:      document.getElementById('events-loading'),

  // Controls
  startButton:        document.getElementById('start-button'),
  navHome:            document.getElementById('nav-home'),

  // Popup
  popup:              document.getElementById('instagram-popup'),
  confettiLayer:      document.getElementById('confetti-layer'),
  closePopupButton:   document.getElementById('close-popup-button'),
  instagramKicker:    document.getElementById('instagram-kicker'),
  instagramTitle:     document.getElementById('instagram-title'),
  instagramHeadline:  document.getElementById('instagram-headline'),
  instagramHandle:    document.getElementById('instagram-handle'),
  instagramBody:      document.getElementById('instagram-body'),
};

// ─── VIEW META ───────────────────────────────────────────
const VIEWS = {
  home:     { el: els.viewHome },
  map:      { el: els.viewMap },
  website:  { el: els.viewWebsite },
  info:     { el: els.viewInfo },
  partners: { el: els.viewPartners },
};

// ─── STATIC COPY ─────────────────────────────────────────
function applyCopy() {
  if (els.eventLabelPill) els.eventLabelPill.textContent = EVENT_CONFIG.label;
  if (els.eventDate)      els.eventDate.textContent      = EVENT_CONFIG.date;
  if (els.ctaText)        els.ctaText.textContent        = EVENT_CONFIG.ctaText;
  if (els.instagramKicker)   els.instagramKicker.textContent   = POPUP_CONFIG.kicker;
  if (els.instagramTitle)    els.instagramTitle.textContent    = POPUP_CONFIG.title;
  if (els.instagramHeadline) els.instagramHeadline.textContent = POPUP_CONFIG.headline;
  if (els.instagramHandle)   els.instagramHandle.textContent   = POPUP_CONFIG.handle;
  if (els.instagramBody)     els.instagramBody.textContent     = POPUP_CONFIG.body;

  if (els.webUrl)      els.webUrl.textContent      = URL_CONFIG.website;
  if (els.partnersUrl) els.partnersUrl.textContent = URL_CONFIG.partners;
  if (els.webFallbackUrl)      els.webFallbackUrl.textContent      = URL_CONFIG.website;
  if (els.partnersFallbackUrl) els.partnersFallbackUrl.textContent = URL_CONFIG.partners;
}

// ─── HELPERS ─────────────────────────────────────────────
function clearChildren(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

function formatName(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getMapUrl() {
  const url = new URL(MAP_CONFIG.embedUrl);
  if (!url.searchParams.has('embedded')) url.searchParams.set('embedded', 'true');
  if (!url.searchParams.has('kiosk'))    url.searchParams.set('kiosk', 'true');
  return url.toString();
}

// ─── GITHUB LOGO FETCHING ────────────────────────────────
function getRepoContext() {
  const ownerFromHost = window.location.hostname.endsWith('.github.io')
    ? window.location.hostname.split('.')[0] : '';
  const repoFromPath  = window.location.pathname.split('/').filter(Boolean)[0] || '';
  return {
    owner:  LOGO_CONFIG.githubOwner  || ownerFromHost,
    repo:   LOGO_CONFIG.githubRepo   || repoFromPath,
    branch: LOGO_CONFIG.githubBranch || 'main',
  };
}

function getCacheKey(dir) {
  const { owner, repo, branch } = getRepoContext();
  return `kiosk-logo-cache:${owner}:${repo}:${branch}:${dir}`;
}

function readCache(dir) {
  try {
    const raw = localStorage.getItem(getCacheKey(dir));
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p.expiresAt || Date.now() > p.expiresAt || !Array.isArray(p.items)) return null;
    return p.items;
  } catch { return null; }
}

function writeCache(dir, items) {
  try {
    localStorage.setItem(getCacheKey(dir), JSON.stringify({
      expiresAt: Date.now() + TIMING_CONFIG.logoCacheTtlMs,
      items,
    }));
  } catch { /* ignore */ }
}

async function fetchLogosFromGitHub(dir) {
  const cached = readCache(dir);
  if (cached) return cached;

  const { owner, repo, branch } = getRepoContext();
  if (!owner || !repo) return [];

  const endpoint = `https://api.github.com/repos/${owner}/${repo}/contents/${dir}?ref=${branch}`;
  const res = await fetch(endpoint, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${dir}`);

  const entries = await res.json();
  const items = entries
    .filter((e) => e.type === 'file')
    .filter((e) => LOGO_CONFIG.supportedExtensions.includes((e.name.split('.').pop() || '').toLowerCase()))
    .map((e) => ({ id: e.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: formatName(e.name), src: e.download_url }))
    .sort((a, b) => a.name.localeCompare(b.name));

  writeCache(dir, items);
  return items;
}

// ─── PARTNER LOGO ROW ────────────────────────────────────
function renderPartnerRow() {
  clearChildren(els.partnerLogosRow);
  if (!state.partnerLogos.length) {
    const hint = document.createElement('div');
    hint.className = 'partner-empty-hint';
    hint.innerHTML = 'Add partner logos to <code>assets/employers/partners/</code>';
    els.partnerLogosRow.appendChild(hint);
    return;
  }
  state.partnerLogos.forEach((logo) => {
    const card = document.createElement('div');
    card.className = 'partner-logo-card';
    const img = document.createElement('img');
    img.src = logo.src; img.alt = logo.name; img.loading = 'lazy';
    card.appendChild(img);
    els.partnerLogosRow.appendChild(card);
  });
}

// ─── ATTENDING EMPLOYERS: ANIMATED TICKER ────────────────
function buildTicker() {
  clearChildren(els.logoTickerTrack);
  if (!state.attendeeLogos.length) {
    const empty = document.createElement('div');
    empty.className = 'ticker-empty';
    empty.textContent = 'Add attendee logos to assets/employers/attendees/';
    els.logoTickerTrack.appendChild(empty);
    return;
  }

  [0, 1].forEach(() => {
    const strip = document.createElement('div');
    strip.className = 'ticker-strip';
    state.attendeeLogos.forEach((logo) => {
      const card = document.createElement('div');
      card.className = 'ticker-card';
      const img = document.createElement('img');
      img.src = logo.src; img.alt = logo.name; img.loading = 'lazy';
      card.appendChild(img);
      strip.appendChild(card);
    });
    els.logoTickerTrack.appendChild(strip);
  });

  const speed = Math.max(30, state.attendeeLogos.length * 1.4);
  els.logoTickerTrack.style.setProperty('--ticker-duration', `${speed}s`);
  els.logoTickerTrack.classList.add('is-running');
}

// ─── EVENTS FEED (Info view) ─────────────────────────────
const EVENTS_API = 'https://news.csun.edu/wp-json/csunfeeds/v1/events-feed/career-center';

function stripHtml(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent || d.innerText || '';
}

async function loadEvents() {
  if (state.eventsLoaded) return;
  state.eventsLoaded = true;

  try {
    let data;
    try {
      const res = await fetch(EVENTS_API);
      if (!res.ok) throw new Error('direct fetch failed');
      data = await res.json();
    } catch {
      const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(EVENTS_API)}`;
      const res2 = await fetch(proxy);
      data = await res2.json();
    }

    if (els.eventsLoading) els.eventsLoading.style.display = 'none';
    const events = Array.isArray(data) ? data : (data.events || data.items || []);

    if (!events.length) {
      els.eventsGrid.innerHTML = '<p class="events-empty">No upcoming events found.</p>';
      return;
    }

    events.slice(0, 20).forEach((ev) => {
      const card = document.createElement('article');
      card.className = 'event-card';

      const img = ev.image || ev.featured_image || ev.thumbnail || '';
      const imgEl = document.createElement('div');
      if (img) {
        imgEl.className = 'event-card__img';
        imgEl.style.backgroundImage = `url(${img})`;
      } else {
        imgEl.className = 'event-card__img event-card__img--placeholder';
        imgEl.innerHTML = `<svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="#ccc" stroke-width="2"><rect x="4" y="8" width="40" height="32" rx="3"/><path d="M4 18h40"/><circle cx="14" cy="13" r="2" fill="#ccc"/><circle cx="34" cy="13" r="2" fill="#ccc"/></svg>`;
      }
      card.appendChild(imgEl);

      const body = document.createElement('div');
      body.className = 'event-card__body';

      const dateStr = ev.start_date || ev.date || ev.event_date || '';
      if (dateStr) {
        const dateEl = document.createElement('div');
        dateEl.className = 'event-card__date';
        try {
          const d = new Date(dateStr);
          dateEl.textContent = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
          dateEl.textContent = dateStr;
        }
        body.appendChild(dateEl);
      }

      const title = ev.title || ev.name || '';
      if (title) {
        const h = document.createElement('h3');
        h.className = 'event-card__title';
        h.textContent = stripHtml(title);
        body.appendChild(h);
      }

      const desc = ev.description || ev.excerpt || ev.content || '';
      if (desc) {
        const p = document.createElement('p');
        p.className = 'event-card__desc';
        p.textContent = stripHtml(desc).substring(0, 160) + '…';
        body.appendChild(p);
      }

      card.appendChild(body);
      els.eventsGrid.appendChild(card);
    });
  } catch (err) {
    console.error('Events load error', err);
    if (els.eventsLoading) els.eventsLoading.style.display = 'none';
    els.eventsGrid.innerHTML = '<p class="events-empty">Unable to load events at this time.</p>';
  }
}

// ─── PROXY-BACKED WEB LOADER ─────────────────────────────
// Most external sites (csun.edu, etc.) send X-Frame-Options: SAMEORIGIN
// which blocks iframe embedding. Since this kiosk is a static GitHub Pages
// site we can't run our own proxy, so we:
//   1. Try each public CORS proxy in order.
//   2. Fetch the raw HTML, inject a <base> tag so relative URLs resolve,
//      and rewrite form targets to _top to avoid further framing.
//   3. Render the HTML into the iframe via srcdoc – this bypasses
//      X-Frame-Options because no HTTP response is being framed.
//   4. If every proxy fails, show a QR / URL fallback panel so users can
//      open the site on their phone.
async function fetchThroughProxy(url) {
  const proxies = URL_CONFIG.corsProxies || [];
  let lastErr;
  for (const build of proxies) {
    try {
      const proxyUrl = build(url);
      const res = await fetch(proxyUrl, { cache: 'no-store' });
      if (!res.ok) { lastErr = new Error(`proxy ${res.status}`); continue; }
      const html = await res.text();
      if (!html || html.length < 200) { lastErr = new Error('empty response'); continue; }
      return html;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('All proxies failed');
}

function rewriteHtmlForFraming(html, baseUrl) {
  let out = html;

  // Inject <base> so relative assets + links resolve against the real origin.
  const baseTag = `<base href="${baseUrl}">`;
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (m) => `${m}\n${baseTag}`);
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html[^>]*>/i, (m) => `${m}<head>${baseTag}</head>`);
  } else {
    out = `<head>${baseTag}</head>${out}`;
  }

  // Strip <meta http-equiv="X-Frame-Options">, Content-Security-Policy, refresh.
  out = out.replace(/<meta[^>]+http-equiv=["'](?:X-Frame-Options|Content-Security-Policy|refresh)["'][^>]*>/gi, '');

  // Neutralize "frame-busting" scripts that try to redirect when framed.
  out = out.replace(/top\.location(\s*=|\s*\.replace)/gi, '/*kiosk*/null');
  out = out.replace(/parent\.location(\s*=|\s*\.replace)/gi, '/*kiosk*/null');

  // Make links/forms target the iframe itself instead of _top.
  out = out.replace(/target=["']_top["']/gi, 'target="_self"');
  out = out.replace(/target=["']_parent["']/gi, 'target="_self"');

  return out;
}

async function loadIntoFrame({ url, frame, loadingEl, fallbackEl, stateKey }) {
  state.webLoadState[stateKey] = 'loading';
  if (loadingEl) loadingEl.classList.remove('is-hidden');
  if (fallbackEl) fallbackEl.classList.add('is-hidden');
  frame.classList.remove('is-hidden');

  // Phase 1: try direct load. Many iframes fail silently due to XFO, so
  // we race it against a timeout; if the timeout wins, fall back to proxy.
  const directOk = await new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; resolve(false); } }, 3500);
    const onLoad = () => {
      if (done) return;
      // If the iframe loaded but is actually the blank fallback (e.g. because
      // the browser refused to frame), the contentWindow's location may be
      // about:blank. We can't read cross-origin contents so just assume ok.
      done = true; clearTimeout(timer); resolve(true);
    };
    const onError = () => {
      if (done) return;
      done = true; clearTimeout(timer); resolve(false);
    };
    frame.addEventListener('load', onLoad, { once: true });
    frame.addEventListener('error', onError, { once: true });
    try {
      frame.removeAttribute('srcdoc');
      frame.src = url;
    } catch {
      done = true; clearTimeout(timer); resolve(false);
    }
  });

  // We can't actually trust onLoad (browsers still fire 'load' even when
  // X-Frame-Options blocked rendering). So we always also try the proxy
  // path once to guarantee something shows up.
  try {
    const html = await fetchThroughProxy(url);
    const rewritten = rewriteHtmlForFraming(html, url);
    // Use srcdoc for guaranteed render. This replaces the direct src.
    frame.removeAttribute('src');
    frame.srcdoc = rewritten;

    await new Promise((resolve) => {
      const t = setTimeout(resolve, 4000);
      frame.addEventListener('load', () => { clearTimeout(t); resolve(); }, { once: true });
    });

    if (loadingEl) loadingEl.classList.add('is-hidden');
    state.webLoadState[stateKey] = 'ready';
  } catch (err) {
    console.warn('[kiosk] proxy load failed', err);
    if (directOk) {
      // At least the direct load fired; keep it and hide spinner.
      if (loadingEl) loadingEl.classList.add('is-hidden');
      state.webLoadState[stateKey] = 'ready';
    } else {
      // Nothing worked → show QR fallback.
      if (loadingEl) loadingEl.classList.add('is-hidden');
      frame.classList.add('is-hidden');
      if (fallbackEl) fallbackEl.classList.remove('is-hidden');
      state.webLoadState[stateKey] = 'error';
    }
  }
}

function ensureWebsiteLoaded() {
  if (state.webLoadState.website === 'loading' || state.webLoadState.website === 'ready') return;
  loadIntoFrame({
    url: URL_CONFIG.website,
    frame: els.websiteFrame,
    loadingEl: els.webLoading,
    fallbackEl: els.webFallback,
    stateKey: 'website',
  });
}

function ensurePartnersLoaded() {
  if (state.webLoadState.partners === 'loading' || state.webLoadState.partners === 'ready') return;
  loadIntoFrame({
    url: URL_CONFIG.partners,
    frame: els.partnersFrame,
    loadingEl: els.partnersLoading,
    fallbackEl: els.partnersFallback,
    stateKey: 'partners',
  });
}

// ─── VIEW SWITCHING ──────────────────────────────────────
function setView(viewId) {
  if (!VIEWS[viewId]) return;

  Object.entries(VIEWS).forEach(([id, meta]) => {
    const isActive = id === viewId;
    if (meta.el) {
      meta.el.classList.toggle('is-active', isActive);
      meta.el.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    }
  });

  document.querySelectorAll('.sidebar-item[data-view]').forEach((btn) => {
    btn.classList.toggle('sidebar-item--active', btn.dataset.view === viewId);
  });

  els.app.dataset.view = viewId;
  state.activeView = viewId;

  // Load content lazily
  if (viewId === 'map' && !state.mapLoaded) {
    els.mappedinFrame.src = getMapUrl();
    state.mapLoaded = true;
  }
  if (viewId === 'website') ensureWebsiteLoaded();
  if (viewId === 'partners') ensurePartnersLoaded();
  if (viewId === 'info') loadEvents();

  // Inactivity + popup scheduling
  if (viewId === 'home') {
    clearInactivityTimers();
    clearPopupTimers();
    if (els.countdownPill) els.countdownPill.classList.add('is-hidden');
    state.sessionPopupShown = false;
  } else {
    if (els.countdownPill) els.countdownPill.classList.remove('is-hidden');
    resetInactivityTimer();
    schedulePopup();
  }
}

function goHome() {
  setView('home');
  closePopup();
}

function restartSession() {
  state.sessionPopupShown = false;
  closePopup();
  clearPopupTimers();
  state.mapLoaded = false;
  els.mappedinFrame.src = getMapUrl();
  state.mapLoaded = true;
  state.eventsLoaded = false;
  window.setTimeout(() => {
    resetInactivityTimer();
    schedulePopup();
  }, 400);
}

// ─── INACTIVITY TIMER ────────────────────────────────────
function clearInactivityTimers() {
  if (state.inactivityTimer)  { clearTimeout(state.inactivityTimer);  state.inactivityTimer  = null; }
  if (state.countdownTimer)   { clearInterval(state.countdownTimer);  state.countdownTimer   = null; }
}

function updateCountdownDisplay(expiresAt) {
  const s = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  if (els.countdownPill) els.countdownPill.textContent = `Home in ${s}s`;
}

function resetInactivityTimer() {
  if (state.activeView === 'home') return;
  clearInactivityTimers();
  const expiresAt = Date.now() + TIMING_CONFIG.inactivityTimeoutMs;
  updateCountdownDisplay(expiresAt);
  state.countdownTimer  = setInterval(() => updateCountdownDisplay(expiresAt), 1000);
  state.inactivityTimer = setTimeout(() => goHome(), TIMING_CONFIG.inactivityTimeoutMs);
}

// ─── POPUP ───────────────────────────────────────────────
function clearPopupTimers() {
  if (state.popupTimer)         { clearTimeout(state.popupTimer);         state.popupTimer         = null; }
  if (state.popupAutoCloseTimer){ clearTimeout(state.popupAutoCloseTimer); state.popupAutoCloseTimer = null; }
}

function buildConfetti() {
  clearChildren(els.confettiLayer);
  const palette = ['#d22030', '#ff6f61', '#ffd7db', '#ffffff', '#f5a623'];
  Array.from({ length: 44 }).forEach((_, i) => {
    const p = document.createElement('span');
    p.className = 'confetti-piece';
    p.style.left            = `${Math.random() * 100}%`;
    p.style.width           = `${8 + Math.random() * 10}px`;
    p.style.height          = `${10 + Math.random() * 18}px`;
    p.style.background      = palette[i % palette.length];
    p.style.animationDelay  = `${Math.random() * 0.8}s`;
    p.style.animationDuration = `${3.8 + Math.random() * 2.2}s`;
    p.style.transform       = `translateY(-120%) rotate(${Math.random() * 360}deg)`;
    els.confettiLayer.appendChild(p);
  });
}

function showPopup() {
  if (state.sessionPopupShown || state.activeView === 'home') return;
  state.sessionPopupShown = true;
  buildConfetti();
  els.popup.classList.remove('is-hidden');
  els.app.classList.add('is-modal-open');
  state.popupAutoCloseTimer = setTimeout(() => closePopup(), TIMING_CONFIG.popupAutoCloseMs);
}

function closePopup() {
  els.popup.classList.add('is-hidden');
  els.app.classList.remove('is-modal-open');
  clearPopupTimers();
}

function schedulePopup() {
  clearPopupTimers();
  if (state.sessionPopupShown || state.activeView === 'home') return;
  state.popupTimer = setTimeout(() => showPopup(), TIMING_CONFIG.popupDelayMs);
}

// ─── EVENT BINDING ───────────────────────────────────────
function bindEvents() {
  if (els.startButton) els.startButton.addEventListener('click', () => setView('map'));

  document.querySelectorAll('.sidebar-item[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  if (els.closePopupButton) els.closePopupButton.addEventListener('click', () => { closePopup(); setView('map'); });
  if (els.popup) els.popup.addEventListener('click', (e) => { if (e.target === els.popup) closePopup(); });

  // Kiosk "expand" buttons toggle fullscreen on the iframe section
  const toggleExpand = (sectionEl) => {
    if (!sectionEl) return;
    sectionEl.classList.toggle('is-expanded');
  };
  if (els.webOpenExternal)      els.webOpenExternal.addEventListener('click', () => toggleExpand(els.viewWebsite));
  if (els.partnersOpenExternal) els.partnersOpenExternal.addEventListener('click', () => toggleExpand(els.viewPartners));

  // Reset inactivity on interaction
  ['pointerdown', 'pointermove', 'touchstart', 'keydown'].forEach((ev) => {
    window.addEventListener(ev, () => {
      if (state.activeView !== 'home') resetInactivityTimer();
    }, { passive: true });
  });
}

// ─── LOAD LOGOS ──────────────────────────────────────────
async function loadLogos() {
  try {
    const [attendee, partner] = await Promise.all([
      fetchLogosFromGitHub(LOGO_CONFIG.attendeeDir),
      fetchLogosFromGitHub(LOGO_CONFIG.partnerDir),
    ]);
    state.attendeeLogos = attendee;
    state.partnerLogos  = partner;
  } catch (err) {
    console.error('Logo load error', err);
    state.attendeeLogos = [];
    state.partnerLogos  = [];
  }
  buildTicker();
  renderPartnerRow();
}

// ─── INIT ────────────────────────────────────────────────
function init() {
  applyCopy();
  bindEvents();
  loadLogos();
  setView('home');
}

init();
