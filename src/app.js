import { EVENT_CONFIG } from './config/event.js';
import { LOGO_CONFIG } from './config/logos.js';
import { MAP_CONFIG } from './config/map.js';
import { POPUP_CONFIG } from './config/popup.js';
import { TIMING_CONFIG } from './config/timing.js';

// ─── STATE ────────────────────────────────────────────────
const state = {
  mode: 'home',          // 'home' | 'panel'
  activePanel: 'map',   // 'map' | 'website' | 'events' | 'partners'
  inactivityTimer: null,
  countdownTimer: null,
  popupTimer: null,
  popupAutoCloseTimer: null,
  sessionPopupShown: false,
  attendeeLogos: [],
  partnerLogos: [],
  eventsLoaded: false,
  tickerAnimationId: null,
};

// ─── ELEMENT CACHE ───────────────────────────────────────
const els = {
  app:                document.getElementById('app'),
  homeScreen:         document.getElementById('home-screen'),
  mapScreen:          document.getElementById('map-screen'),
  eventLabelPill:     document.getElementById('event-label-pill'),
  eventDate:          document.getElementById('event-date'),
  ctaText:            document.getElementById('cta-text'),
  partnerLogosRow:    document.getElementById('partner-logos-row'),
  logoTickerTrack:    document.getElementById('logo-ticker-track'),
  logoTickerShell:    document.getElementById('logo-ticker-shell'),
  mapPartnerTrack:    document.getElementById('map-partner-track'),
  mapPartnerRibbon:   document.getElementById('map-partner-ribbon'),
  startButton:        document.getElementById('start-button'),
  returnHomeButton:   document.getElementById('return-home-button'),
  restartSessionButton: document.getElementById('restart-session-button'),
  countdownPill:      document.getElementById('countdown-pill'),
  mappedinFrame:      document.getElementById('mappedin-frame'),
  websiteFrame:       document.getElementById('website-frame'),
  partnersFrame:      document.getElementById('partners-frame'),
  panelTitle:         document.getElementById('panel-title'),
  subMap:             document.getElementById('sub-map'),
  subWebsite:         document.getElementById('sub-website'),
  subEvents:          document.getElementById('sub-events'),
  subPartners:        document.getElementById('sub-partners'),
  eventsGrid:         document.getElementById('events-grid'),
  eventsLoading:      document.getElementById('events-loading'),
  popup:              document.getElementById('instagram-popup'),
  confettiLayer:      document.getElementById('confetti-layer'),
  closePopupButton:   document.getElementById('close-popup-button'),
  instagramKicker:    document.getElementById('instagram-kicker'),
  instagramTitle:     document.getElementById('instagram-title'),
  instagramHeadline:  document.getElementById('instagram-headline'),
  instagramHandle:    document.getElementById('instagram-handle'),
  instagramBody:      document.getElementById('instagram-body'),
  instagramLink:      document.getElementById('instagram-link'),
  inappBrowser:       document.getElementById('inapp-browser'),
  inappFrame:         document.getElementById('inapp-frame'),
  inappUrl:           document.getElementById('inapp-url'),
  inappClose:         document.getElementById('inapp-close'),
};

// ─── PANEL META ───────────────────────────────────────────
const PANEL_META = {
  map:      { title: 'Career Fair Map',           subEl: 'subMap',      frameId: null },
  website:  { title: 'CSUN Career Center',        subEl: 'subWebsite',  frameId: 'website-frame' },
  events:   { title: 'Upcoming Events',           subEl: 'subEvents',   frameId: null },
  partners: { title: 'Our Employer Partners',     subEl: 'subPartners', frameId: 'partners-frame' },
};

// ─── APPLY STATIC COPY ───────────────────────────────────
function applyCopy() {
  if (els.eventLabelPill) els.eventLabelPill.textContent = EVENT_CONFIG.label;
  if (els.eventDate)      els.eventDate.textContent      = EVENT_CONFIG.date;
  if (els.ctaText)        els.ctaText.textContent        = EVENT_CONFIG.ctaText;
  if (els.instagramKicker)   els.instagramKicker.textContent   = POPUP_CONFIG.kicker;
  if (els.instagramTitle)    els.instagramTitle.textContent    = POPUP_CONFIG.title;
  if (els.instagramHeadline) els.instagramHeadline.textContent = POPUP_CONFIG.headline;
  if (els.instagramHandle)   els.instagramHandle.textContent   = POPUP_CONFIG.handle;
  if (els.instagramBody)     els.instagramBody.textContent     = POPUP_CONFIG.body;
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

// ─── PARTNER LOGO ROW (horizontal scroll if many) ───────
function renderPartnerRow() {
  clearChildren(els.partnerLogosRow);
  clearChildren(els.mapPartnerTrack);

  if (!state.partnerLogos.length) {
    const hint = document.createElement('div');
    hint.className = 'partner-empty-hint';
    hint.innerHTML = 'Add partner logos to <code>assets/employers/partners/</code>';
    els.partnerLogosRow.appendChild(hint);
    els.mapPartnerRibbon.classList.add('is-empty');
    return;
  }

  els.mapPartnerRibbon.classList.remove('is-empty');

  state.partnerLogos.forEach((logo) => {
    const card = document.createElement('div');
    card.className = 'partner-logo-card';
    const img = document.createElement('img');
    img.src = logo.src; img.alt = logo.name; img.loading = 'lazy';
    card.appendChild(img);
    els.partnerLogosRow.appendChild(card);

    // also map ribbon
    const chip = document.createElement('div');
    chip.className = 'map-partner-chip';
    const img2 = document.createElement('img');
    img2.src = logo.src; img2.alt = logo.name; img2.loading = 'lazy';
    chip.appendChild(img2);
    els.mapPartnerTrack.appendChild(chip);
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

  // Build two strips side-by-side for seamless infinite loop
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

  // Kick off CSS animation via class (duration proportional to logo count)
  const speed = Math.max(30, state.attendeeLogos.length * 1.4); // seconds
  els.logoTickerTrack.style.setProperty('--ticker-duration', `${speed}s`);
  els.logoTickerTrack.classList.add('is-running');
}

// ─── EVENTS FEED ─────────────────────────────────────────
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
    // Attempt direct fetch first; fallback to CORS proxy if needed
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

    // The feed may be an array or have a property containing events
    const events = Array.isArray(data) ? data : (data.events || data.items || []);

    if (!events.length) {
      els.eventsGrid.innerHTML = '<p class="events-empty">No upcoming events found.</p>';
      return;
    }

    events.slice(0, 20).forEach((ev) => {
      const card = document.createElement('article');
      card.className = 'event-card';

      // Image
      const img = ev.image || ev.featured_image || ev.thumbnail || '';
      if (img) {
        const imgEl = document.createElement('div');
        imgEl.className = 'event-card__img';
        imgEl.style.backgroundImage = `url(${img})`;
        card.appendChild(imgEl);
      } else {
        const imgEl = document.createElement('div');
        imgEl.className = 'event-card__img event-card__img--placeholder';
        imgEl.innerHTML = `<svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="#ccc" stroke-width="2"><rect x="4" y="8" width="40" height="32" rx="3"/><path d="M4 18h40"/><circle cx="14" cy="13" r="2" fill="#ccc"/><circle cx="34" cy="13" r="2" fill="#ccc"/></svg>`;
        card.appendChild(imgEl);
      }

      const body = document.createElement('div');
      body.className = 'event-card__body';

      // Date/time
      const dateStr = ev.start_date || ev.date || ev.event_date || '';
      if (dateStr) {
        const dateEl = document.createElement('div');
        dateEl.className = 'event-card__date';
        // Try to parse and format nicely
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

// ─── IN-APP BROWSER ──────────────────────────────────────
function openInAppBrowser(url) {
  els.inappFrame.src = url;
  els.inappUrl.textContent = url;
  els.inappBrowser.classList.remove('is-hidden');
}

function closeInAppBrowser() {
  els.inappBrowser.classList.add('is-hidden');
  els.inappFrame.src = 'about:blank';
}

// ─── PANEL / SCREEN SWITCHING ────────────────────────────
const PANEL_IDS = ['map', 'website', 'events', 'partners'];

function switchToPanel(panelId) {
  // Hide all sub-panels
  PANEL_IDS.forEach((id) => {
    const el = els[`sub${id.charAt(0).toUpperCase() + id.slice(1)}`];
    if (el) el.classList.replace('is-active', 'is-hidden') || el.classList.add('is-hidden');
  });

  // Show target
  const meta = PANEL_META[panelId];
  if (!meta) return;

  const target = els[meta.subEl];
  if (target) {
    target.classList.remove('is-hidden');
    target.classList.add('is-active');
  }

  // Update title
  if (els.panelTitle) els.panelTitle.textContent = meta.title;

  // Update sidebar active state
  document.querySelectorAll('.panel-nav-item[data-target]').forEach((btn) => {
    btn.classList.toggle('panel-nav-item--active', btn.dataset.target === panelId + '-screen');
  });

  state.activePanel = panelId;

  // Lazy-load events
  if (panelId === 'events') loadEvents();

  // Reset inactivity when switching panels
  resetInactivityTimer();
}

function openPanelScreen(panelId) {
  state.mode = 'panel';
  els.homeScreen.classList.add('is-hidden');
  els.mapScreen.classList.remove('is-hidden');
  els.app.dataset.mode = 'panel';

  // Load map iframe if not yet loaded
  if (!els.mappedinFrame.src || els.mappedinFrame.src === 'about:blank') {
    els.mappedinFrame.src = getMapUrl();
  }

  switchToPanel(panelId);

  window.setTimeout(() => {
    resetInactivityTimer();
    schedulePopup();
  }, TIMING_CONFIG.transitionPauseMs);
}

function goHome({ resetMap = false } = {}) {
  state.mode = 'home';
  state.sessionPopupShown = false;
  els.mapScreen.classList.add('is-hidden');
  els.homeScreen.classList.remove('is-hidden');
  els.app.dataset.mode = 'home';
  closePopup();
  closeInAppBrowser();
  clearInactivityTimers();
  if (resetMap) els.mappedinFrame.src = getMapUrl();
}

function restartSession() {
  state.sessionPopupShown = false;
  closePopup();
  clearPopupTimers();
  els.mappedinFrame.src = getMapUrl();
  state.eventsLoaded = false; // allow reload
  window.setTimeout(() => {
    resetInactivityTimer();
    schedulePopup();
  }, 500);
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
  if (state.mode !== 'panel') return;
  clearInactivityTimers();
  const expiresAt = Date.now() + TIMING_CONFIG.inactivityTimeoutMs;
  updateCountdownDisplay(expiresAt);
  state.countdownTimer  = setInterval(() => updateCountdownDisplay(expiresAt), 1000);
  state.inactivityTimer = setTimeout(() => goHome({ resetMap: true }), TIMING_CONFIG.inactivityTimeoutMs);
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
  if (state.sessionPopupShown || state.mode !== 'panel') return;
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
  if (state.sessionPopupShown || state.mode !== 'panel') return;
  state.popupTimer = setTimeout(() => showPopup(), TIMING_CONFIG.popupDelayMs);
}

// ─── EVENT BINDING ───────────────────────────────────────
function bindEvents() {
  // Home → open map panel
  els.startButton.addEventListener('click', () => openPanelScreen('map'));

  // Home sidebar buttons → open their panel
  document.querySelectorAll('.sidebar-item[data-panel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panelId = btn.dataset.panel.replace('-screen', '');
      openPanelScreen(panelId);
    });
  });

  // Panel sidebar nav buttons
  document.querySelectorAll('.panel-nav-item[data-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panelId = btn.dataset.target.replace('-screen', '');
      switchToPanel(panelId);
    });
  });

  // Back to home
  if (els.returnHomeButton) els.returnHomeButton.addEventListener('click', () => goHome({ resetMap: true }));

  // Restart
  if (els.restartSessionButton) els.restartSessionButton.addEventListener('click', restartSession);

  // Popup close
  if (els.closePopupButton) els.closePopupButton.addEventListener('click', closePopup);
  if (els.popup) els.popup.addEventListener('click', (e) => { if (e.target === els.popup) closePopup(); });

  // Instagram link → in-app browser
  if (els.instagramLink) {
    els.instagramLink.addEventListener('click', () => {
      closePopup();
      openInAppBrowser(POPUP_CONFIG.linkUrl);
    });
  }

  // In-app browser close
  if (els.inappClose) els.inappClose.addEventListener('click', closeInAppBrowser);

  // Inactivity reset on any touch/move
  ['pointerdown', 'pointermove', 'touchstart', 'mousemove', 'keydown'].forEach((ev) => {
    window.addEventListener(ev, () => {
      if (state.mode === 'panel') resetInactivityTimer();
    }, { passive: true });
  });

  // Resize: no-op now (ticker is CSS-driven)
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
  goHome({ resetMap: false });
}

init();
