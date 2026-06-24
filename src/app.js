import { BRANDING_CONFIG } from './config/branding.js';
import { EVENT_CONFIG, HEADER_PAGE_CONTEXT } from './config/event.js';
import { LOGO_CONFIG } from './config/logos.js';
import { MAP_CONFIG } from './config/map.js';
import { POPUP_CONFIG } from './config/popup.js';
import { TIMING_CONFIG } from './config/timing.js';
import { URL_CONFIG } from './config/urls.js';
import { loadConfig, buildMapUrl } from './shared/config.js';
import { loadJobs } from './shared/jobs-loader.js';
import { apiUrl, resolveApiBase } from './shared/api-base.js';
import { initJobsPage, loadJobsPage, getJobsPageElements, resetJobsSession } from './jobs-page.js';
import { initIdleAdPlayer } from './idle-ad-player.js';

// ─── STATE ────────────────────────────────────────────────
const state = {
  activeView: 'home',    // 'home' | 'map' | 'website' | 'info' | 'jobs' | 'checkin' | 'partners'
  inactivityTimer: null,
  countdownTimer: null,
  popupTimer: null,
  popupAutoCloseTimer: null,
  sessionPopupShown: false,
  attendeeLogos: [],
  partnerLogos: [],
  eventsLoaded: false,
  mapLoaded: false,
  mapUrlOverride: null,
  configVersion: 0,
  idleAdPlayer: null,
  webLoadState: { website: 'idle', partners: 'idle' },
  webHtmlCache: {},
  checkIn: { mode: 'url', url: '', embed: '' },
  checkInLoaded: false,
  checkInLoadState: 'idle',
  checkInTargetUrl: '',
  clockTimer: null,
  clockSyncTimer: null,
  clockOffsetMs: 0,
};

// ─── ELEMENT CACHE ───────────────────────────────────────
const els = {
  app:                document.getElementById('app'),
  eventLabelPill:     document.getElementById('event-label-pill'),
  eventDate:          document.getElementById('event-date'),
  eventDateLabel:     document.getElementById('event-date-label'),
  headerPageTitle:    document.getElementById('header-page-title'),
  headerPageSubtitle: document.getElementById('header-page-subtitle'),
  ctaText:            document.getElementById('cta-text'),
  countdownPill:      document.getElementById('countdown-pill'),
  countdownPillLabel:   document.getElementById('countdown-pill-label'),
  countdownRingProgress: document.getElementById('countdown-ring-progress'),
  ctaBar:             document.getElementById('cta-bar'),
  ctaLabel:           document.getElementById('cta-label'),

  // NeoGlass home
  kioskHeroBg:        document.getElementById('kiosk-hero-bg'),
  kioskClock:         document.getElementById('kiosk-clock'),
  kioskHeroEyebrow:   document.getElementById('kiosk-hero-eyebrow'),
  kioskHeroDesc:      document.getElementById('kiosk-hero-desc'),
  kioskHeroCtaLabel:  document.getElementById('kiosk-hero-cta-label'),
  kioskHeroMapBtn:    document.getElementById('kiosk-hero-map-btn'),
  statEmployers:      document.getElementById('stat-employers'),
  statOpportunities:  document.getElementById('stat-opportunities'),

  // Home view content
  partnerLogosRow:    document.getElementById('partner-logos-row'),
  partnerTrack:       document.getElementById('partner-track'),
  partnerScrollShell: document.getElementById('partner-scroll-shell'),
  tickerGrid:         document.getElementById('ticker-grid'),
  tickerShell:        document.getElementById('logo-ticker-shell'),

  // Views
  viewHome:           document.getElementById('view-home'),
  viewMap:            document.getElementById('view-map'),
  viewWebsite:        document.getElementById('view-website'),
  viewInfo:           document.getElementById('view-info'),
  viewJobs:           document.getElementById('view-jobs'),
  viewPartners:       document.getElementById('view-partners'),
  viewCheckin:        document.getElementById('view-checkin'),

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

  // Check In view
  checkinFrame:       document.getElementById('checkin-frame'),
  checkinLoading:     document.getElementById('checkin-loading'),
  checkinEmbed:       document.getElementById('checkin-embed'),
  checkinFallback:    document.getElementById('checkin-fallback'),
  checkinFallbackUrl: document.getElementById('checkin-fallback-url'),
  checkinOpenBtn:     document.getElementById('checkin-open-btn'),
  checkinEmpty:       document.getElementById('checkin-empty'),

  // Info (events)
  eventsGrid:         document.getElementById('events-grid'),
  eventsLoading:      document.getElementById('events-loading'),

  // Controls
  startButton:        document.getElementById('start-button'),
  navHome:            document.getElementById('nav-home'),

  // Controls (extra)
  topbarHomeBtn:      document.getElementById('topbar-home-btn'),
  topbarMobileMapBtn: document.getElementById('topbar-mobile-map-btn'),

  // Popup
  popup:              document.getElementById('instagram-popup'),
  confettiLayer:      document.getElementById('confetti-layer'),
  closePopupButton:   document.getElementById('close-popup-button'),
  instagramCloseX:    document.getElementById('instagram-close-x'),
  instagramKicker:    document.getElementById('instagram-kicker'),
  instagramTitle:     document.getElementById('instagram-title'),
  instagramHeadline:  document.getElementById('instagram-headline'),
  instagramHandle:    document.getElementById('instagram-handle'),
  instagramBody:      document.getElementById('instagram-body'),
  instagramCtaLabel:  document.getElementById('instagram-cta-label'),
  instagramQrImage:   document.getElementById('instagram-qr-image'),
  instagramQrFallback: document.getElementById('instagram-qr-fallback'),
  instagramChips:     document.getElementById('instagram-chips'),

  // Mobile map QR (map view header)
  mobileMapPopup:     document.getElementById('mobile-map-popup'),
  mobileMapCloseX:    document.getElementById('mobile-map-close-x'),
  mobileMapQrImage:   document.getElementById('mobile-map-qr-image'),
  mobileMapQrFallback: document.getElementById('mobile-map-qr-fallback'),

  // Event detail modal
  eventModal:         document.getElementById('event-detail-modal'),
  eventModalScroll:   document.getElementById('event-detail-scroll'),
  eventModalClose:    document.getElementById('event-detail-close'),
  eventModalHero:     document.getElementById('event-detail-hero'),
  eventModalDate:     document.getElementById('event-detail-date'),
  eventModalVenue:    document.getElementById('event-detail-venue'),
  eventModalCost:     document.getElementById('event-detail-cost'),
  eventModalTitle:    document.getElementById('event-detail-title'),
  eventModalContent:  document.getElementById('event-detail-content'),
};

// ─── VIEW META ───────────────────────────────────────────
const VIEWS = {
  home:     { el: els.viewHome },
  map:      { el: els.viewMap },
  website:  { el: els.viewWebsite },
  info:     { el: els.viewInfo },
  jobs:     { el: els.viewJobs },
  partners: { el: els.viewPartners },
  checkin:  { el: els.viewCheckin },
};

// ─── STATIC COPY ─────────────────────────────────────────
function applyCopy() {
  if (els.eventLabelPill) els.eventLabelPill.textContent = EVENT_CONFIG.label;
  if (els.eventDateLabel) els.eventDateLabel.textContent = EVENT_CONFIG.date;
  else if (els.eventDate) els.eventDate.textContent      = EVENT_CONFIG.date;
  if (els.ctaLabel)       els.ctaLabel.textContent       = EVENT_CONFIG.ctaLabel;
  if (els.ctaText)        els.ctaText.textContent        = EVENT_CONFIG.ctaText;
  if (els.kioskHeroEyebrow)  els.kioskHeroEyebrow.textContent  = EVENT_CONFIG.heroEyebrow || EVENT_CONFIG.date;
  if (els.kioskHeroDesc)     els.kioskHeroDesc.textContent     = EVENT_CONFIG.heroDescription;
  if (els.kioskHeroCtaLabel) els.kioskHeroCtaLabel.textContent = EVENT_CONFIG.heroCta;
  if (els.startButton)       els.startButton.textContent       = `${EVENT_CONFIG.ctaButton} →`;
  const kickerText = els.instagramKicker?.querySelector('.follow-modal__pill-text');
  if (kickerText) kickerText.textContent = POPUP_CONFIG.kicker;
  if (els.instagramTitle)    els.instagramTitle.textContent    = POPUP_CONFIG.title;
  if (els.instagramHeadline) els.instagramHeadline.textContent = POPUP_CONFIG.headline;
  if (els.instagramHandle)   els.instagramHandle.textContent   = POPUP_CONFIG.handle;
  if (els.instagramBody)     els.instagramBody.textContent     = POPUP_CONFIG.body;
  if (els.instagramCtaLabel) els.instagramCtaLabel.textContent = POPUP_CONFIG.ctaLabel;

  if (els.instagramChips && Array.isArray(POPUP_CONFIG.chips)) {
    els.instagramChips.innerHTML = POPUP_CONFIG.chips
      .map((label) => `<span class="follow-modal__chip">${label}</span>`)
      .join('');
  }

  if (els.webUrl)      els.webUrl.textContent      = URL_CONFIG.website;
  if (els.partnersUrl) els.partnersUrl.textContent = URL_CONFIG.partners;
  if (els.webFallbackUrl)      els.webFallbackUrl.textContent      = URL_CONFIG.website;
  if (els.partnersFallbackUrl) els.partnersFallbackUrl.textContent = URL_CONFIG.partners;
}

const COUNTDOWN_RING_CIRCUMFERENCE = 2 * Math.PI * 18;

function updateHeaderContext(viewId) {
  const ctx = HEADER_PAGE_CONTEXT[viewId];
  if (!ctx) return;
  if (els.headerPageTitle) els.headerPageTitle.textContent = ctx.title;
  if (els.headerPageSubtitle) {
    els.headerPageSubtitle.textContent = ctx.subtitle;
    els.headerPageSubtitle.classList.toggle('is-hidden', !ctx.subtitle);
  }
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

function siteRootUrl() {
  const { origin, pathname } = window.location;
  let root = pathname.replace(/[^/]*$/, '');
  root = root.replace(/(?:^|\/)(?:mobile|admin)\/+$/, '/');
  if (!root.endsWith('/')) root += '/';
  return `${origin}${root}`;
}

function resolveAssetUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteRootUrl()}${path.replace(/^\//, '')}`;
}

function applyHeroBackground(path) {
  if (!els.kioskHeroBg) return;
  const url = path ? resolveAssetUrl(path) : '';
  if (url) {
    const sep = url.includes('?') ? '&' : '?';
    const busted = `${url}${sep}v=${state.configVersion || Date.now()}`;
    els.kioskHeroBg.style.background = '';
    els.kioskHeroBg.style.backgroundImage = `url("${busted}")`;
    els.kioskHeroBg.style.backgroundSize = 'cover';
    els.kioskHeroBg.style.backgroundPosition = 'center top';
    els.kioskHeroBg.style.backgroundRepeat = 'no-repeat';
  } else {
    els.kioskHeroBg.style.backgroundImage = 'none';
    els.kioskHeroBg.style.background = BRANDING_CONFIG.defaultHeroGradient;
  }
}

function formatStatNumber(value) {
  if (!Number.isFinite(value) || value < 0) return '—';
  return value.toLocaleString('en-US');
}

function setStatValue(el, value) {
  if (!el) return;
  el.removeAttribute('data-loading');
  const formatted = formatStatNumber(value);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || el.textContent === '—' || value === 0) {
    el.textContent = formatted;
    el.classList.add('is-counting');
    return;
  }
  const duration = 520;
  const startTime = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = formatStatNumber(Math.round(value * eased));
    if (t < 1) requestAnimationFrame(tick);
    else {
      el.textContent = formatted;
      el.classList.add('is-counting');
    }
  };
  requestAnimationFrame(tick);
}

async function updateHomeStats() {
  setStatValue(els.statEmployers, state.attendeeLogos.length);
  try {
    const data = await loadJobs();
    const count = data.meta?.totalJobs ?? data.jobs?.length ?? 0;
    setStatValue(els.statOpportunities, count);
  } catch {
    if (els.statOpportunities) {
      els.statOpportunities.textContent = '—';
      els.statOpportunities.setAttribute('data-loading', 'true');
    }
  }
}

function getKioskNow() {
  return new Date(Date.now() + (state.clockOffsetMs || 0));
}

// The kiosk's own device clock is the primary source of truth; the LA time is
// derived purely from `Intl`/`toLocaleString` with the configured timezone, so
// the device's local timezone setting does not matter. We optionally fetch a
// network time only to correct small hardware-clock drift — and we REJECT any
// response that disagrees by more than a few minutes, so a stale/wrong time API
// (e.g. returning a date months in the past) can never corrupt the display.
async function syncClockOffset() {
  const endpoint = TIMING_CONFIG.timeApiUrl;
  if (!endpoint) {
    state.clockOffsetMs = 0;
    return;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(endpoint, { cache: 'no-store', signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return;
    const data = await res.json();
    const raw = data.datetime || data.dateTime || data.utc_datetime;
    const networkMs = raw ? new Date(raw).getTime() : NaN;
    if (!Number.isFinite(networkMs)) return;

    const offset = networkMs - Date.now();
    const maxDriftMs = TIMING_CONFIG.maxClockDriftMs || 5 * 60 * 1000;
    // Only trust the network time for minor drift; ignore wildly-off responses.
    state.clockOffsetMs = Math.abs(offset) <= maxDriftMs ? offset : 0;
  } catch {
    state.clockOffsetMs = 0;
  }
}

function updateClock() {
  if (!els.kioskClock) return;
  const tz = TIMING_CONFIG.kioskTimezone || 'America/Los_Angeles';
  const now = getKioskNow();
  const time = now.toLocaleTimeString('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
  });
  const date = now.toLocaleDateString('en-US', {
    timeZone: tz,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  els.kioskClock.textContent = `${time} · ${date}`;
}

async function startClock() {
  await syncClockOffset();
  updateClock();
  if (state.clockTimer) clearInterval(state.clockTimer);
  if (state.clockSyncTimer) clearInterval(state.clockSyncTimer);
  state.clockTimer = setInterval(updateClock, 30_000);
  state.clockSyncTimer = setInterval(syncClockOffset, TIMING_CONFIG.clockSyncIntervalMs || 3_600_000);
}

function getMapUrl() {
  return buildMapUrl(state.mapUrlOverride || MAP_CONFIG.embedUrl);
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
  // Include the admin-managed config version so every new admin commit
  // automatically invalidates previously-cached logo listings.
  return `kiosk-logo-cache:${owner}:${repo}:${branch}:v${state.configVersion}:${dir}`;
}

function readCache(dir) {
  try {
    const raw = localStorage.getItem(getCacheKey(dir));
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p.expiresAt || Date.now() > p.expiresAt || !Array.isArray(p.items) || !p.items.length) return null;
    return p.items;
  } catch { return null; }
}

function writeCache(dir, items) {
  if (!items?.length) return;
  try {
    localStorage.setItem(getCacheKey(dir), JSON.stringify({
      expiresAt: Date.now() + TIMING_CONFIG.logoCacheTtlMs,
      items,
    }));
  } catch { /* ignore */ }
}

async function fetchLogosFromApi(dir) {
  try {
    const res = await fetch(await apiUrl(`/api/logos?dir=${encodeURIComponent(dir)}`), { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : null;
  } catch {
    return null;
  }
}

async function fetchLogosFromGitHub(dir) {
  const cached = readCache(dir);
  if (cached) return cached;

  const fromApi = await fetchLogosFromApi(dir);
  if (fromApi?.length) {
    writeCache(dir, fromApi);
    return fromApi;
  }

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

// ─── OUR EMPLOYER PARTNERS ───────────────────────────────
// Row is centered by default. If the logos overflow the shell, clone the row
// and kick off a seamless left→right marquee.
function buildPartnerCards(target) {
  state.partnerLogos.forEach((logo) => {
    const card = document.createElement('div');
    card.className = 'partner-logo-card';
    const img = document.createElement('img');
    // Eager load + async decode: these logos live inside a transform-animated
    // marquee (and a cloned copy), where `loading="lazy"` makes the browser
    // treat the off-transform cards as out-of-viewport and never paint them —
    // leaving blank cards until an interaction forces a repaint.
    img.loading = 'eager';
    img.decoding = 'async';
    img.alt = logo.name;
    img.src = logo.src;
    card.appendChild(img);
    target.appendChild(card);
  });
}

function renderPartnerRow() {
  if (!els.partnerTrack || !els.partnerLogosRow) return;

  // Reset any previous marquee state
  els.partnerScrollShell.classList.remove('is-marquee');
  clearChildren(els.partnerTrack);

  if (!state.partnerLogos.length) {
    const hint = document.createElement('div');
    hint.className = 'partner-empty-hint';
    hint.innerHTML = 'Add partner logos to <code>assets/employers/partners/</code>';
    const row = document.createElement('div');
    row.className = 'partner-logos-row';
    row.id = 'partner-logos-row';
    row.appendChild(hint);
    els.partnerTrack.appendChild(row);
    els.partnerLogosRow = row;
    return;
  }

  // Build primary row (re-used both for center layout and marquee).
  const primary = document.createElement('div');
  primary.className = 'partner-logos-row';
  primary.id = 'partner-logos-row';
  buildPartnerCards(primary);
  els.partnerTrack.appendChild(primary);
  els.partnerLogosRow = primary;

  // Measure overflow after layout. If the row is wider than the shell,
  // clone it once for a seamless loop and enable the marquee.
  requestAnimationFrame(() => {
    const shell = els.partnerScrollShell;
    const overflow = primary.scrollWidth > shell.clientWidth + 4;
    if (!overflow) return;

    const clone = document.createElement('div');
    clone.className = 'partner-logos-row';
    clone.setAttribute('aria-hidden', 'true');
    buildPartnerCards(clone);
    els.partnerTrack.appendChild(clone);

    // Scale duration with the number of logos — keeps motion readable.
    const duration = Math.max(24, Math.round(state.partnerLogos.length * 2.2));
    els.partnerTrack.style.setProperty('--partner-duration', `${duration}s`);
    shell.classList.add('is-marquee');
  });
}

// ─── PARTICIPATING EMPLOYERS — 3-column vertical marquee ──
// Distributes logos round-robin across N columns. Each column uses two
// `.ticker-column__chunk` wrappers so translateY(-50%) loops perfectly
// (uniform card size + trailing chunk padding keeps spacing even at the seam).
// Pointer-drag on a card pauses the column and “knocks” neighbours aside.
// Three columns fits narrow / portrait kiosk layouts (e.g. 32" TV vertical).
const TICKER_COLUMNS = 3;

const tickerDrag = {
  active: null,
  raf: null,
};

function makeTickerCard(logo) {
  const card = document.createElement('div');
  card.className = 'ticker-card';
  card.style.setProperty('--card-shimmer-delay', `${Math.random() * 8}s`);

  const logoWrap = document.createElement('div');
  logoWrap.className = 'ticker-card__logo';
  const img = document.createElement('img');
  // Eager load + async decode: cards sit inside a translate-animated, duplicated
  // marquee column where `loading="lazy"` causes blank/missing cards (the browser
  // treats the off-transform copies as out-of-viewport) until a click repaints.
  img.loading = 'eager';
  img.decoding = 'async';
  img.draggable = false;
  img.alt = logo.name || '';
  img.src = logo.src;
  logoWrap.appendChild(img);
  card.appendChild(logoWrap);

  return card;
}

function buildTickerChunk(logos, colIndex, ariaHidden) {
  const chunk = document.createElement('div');
  chunk.className = 'ticker-column__chunk';
  if (ariaHidden) chunk.setAttribute('aria-hidden', 'true');
  logos.forEach((logo) => {
    chunk.appendChild(makeTickerCard(logo));
  });
  return chunk;
}

function buildTicker() {
  if (!els.tickerGrid) return;
  clearChildren(els.tickerGrid);

  if (!state.attendeeLogos.length) {
    const empty = document.createElement('div');
    empty.className = 'ticker-empty';
    empty.textContent = 'Add attendee logos to assets/employers/attendees/';
    els.tickerGrid.appendChild(empty);
    return;
  }

  // Round-robin distribute logos into N columns so each column looks mixed
  const columns = Array.from({ length: TICKER_COLUMNS }, () => []);
  state.attendeeLogos.forEach((logo, i) => {
    columns[i % TICKER_COLUMNS].push(logo);
  });

  columns.forEach((logos, colIndex) => {
    if (!logos.length) return;
    const col = document.createElement('div');
    col.className = 'ticker-column';

    const track = document.createElement('div');
    track.className = 'ticker-column__track';

    track.appendChild(buildTickerChunk(logos, colIndex, false));
    track.appendChild(buildTickerChunk(logos, colIndex, true));

    col.appendChild(track);
    els.tickerGrid.appendChild(col);
  });

  setupTickerInteraction();
}

function setupTickerInteraction() {
  if (!els.tickerGrid) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  els.tickerGrid.removeEventListener('pointerdown', onTickerPointerDown);
  els.tickerGrid.addEventListener('pointerdown', onTickerPointerDown);
}

function onTickerPointerDown(e) {
  const card = e.target.closest('.ticker-card');
  if (!card || !els.tickerGrid.contains(card)) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;

  const track = card.closest('.ticker-column__track');
  const col = card.closest('.ticker-column');
  if (!track || !col) return;

  e.preventDefault();
  col.classList.add('ticker-column--drag');

  const cards = [...track.querySelectorAll('.ticker-card')];
  tickerDrag.active = {
    card,
    track,
    col,
    id: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    cards,
    onMove: onTickerPointerMove,
    onUp: onTickerPointerUp,
  };

  track.classList.add('is-paused');
  card.classList.add('ticker-card--dragging');
  try {
    card.setPointerCapture(e.pointerId);
  } catch { /* ignore */ }

  card.addEventListener('pointermove', onTickerPointerMove);
  card.addEventListener('pointerup', onTickerPointerUp);
  card.addEventListener('pointercancel', onTickerPointerUp);
}

function onTickerPointerMove(e) {
  const d = tickerDrag.active;
  if (!d || e.pointerId !== d.id) return;

  if (tickerDrag.raf) cancelAnimationFrame(tickerDrag.raf);
  tickerDrag.raf = requestAnimationFrame(() => {
    tickerDrag.raf = null;
    const st = tickerDrag.active;
    if (!st || st.id !== e.pointerId) return;
    const { card, startX, startY, cards } = st;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const px = e.clientX;
    const py = e.clientY;

    const maxKnock = 56;
    const reach = 160;

    card.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.06) rotate(${dx * 0.05}deg)`;
    card.style.zIndex = '30';

    for (const c of cards) {
      if (c === card) continue;
      const r = c.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = Math.hypot(px - cx, py - cy) + 10;
      if (dist > reach * 2) {
        c.style.transform = '';
        continue;
      }
      const falloff = Math.max(0, 1 - dist / (reach * 2));
      const force = maxKnock * falloff * falloff;
      const nx = (cx - px) / dist;
      const ny = (cy - py) / dist;
      const kx = Math.max(-maxKnock, Math.min(maxKnock, nx * force));
      const ky = Math.max(-18, Math.min(18, ny * force * 0.35));
      c.style.transform = `translate3d(${kx}px, ${ky}px, 0)`;
    }
  });
}

function onTickerPointerUp(e) {
  const d = tickerDrag.active;
  if (!d || e.pointerId !== d.id) return;

  const { card, track, col, cards, onMove, onUp } = d;
  if (tickerDrag.raf) {
    cancelAnimationFrame(tickerDrag.raf);
    tickerDrag.raf = null;
  }
  tickerDrag.active = null;

  card.removeEventListener('pointermove', onMove);
  card.removeEventListener('pointerup', onUp);
  card.removeEventListener('pointercancel', onUp);
  try {
    card.releasePointerCapture(e.pointerId);
  } catch { /* ignore */ }

  if (!card.isConnected) {
    track.classList.remove('is-paused');
    col.classList.remove('ticker-column--drag');
    return;
  }

  track.classList.remove('is-paused');
  col.classList.remove('ticker-column--drag');
  card.classList.remove('ticker-card--dragging');

  const spring = 'transform 0.42s cubic-bezier(0.22, 1.15, 0.32, 1)';
  card.style.transition = spring;
  card.style.transform = '';
  card.style.zIndex = '';

  for (const c of cards) {
    if (!c.isConnected) continue;
    c.style.transition = spring;
    c.style.transform = '';
  }

  window.setTimeout(() => {
    if (card.isConnected) card.style.transition = '';
    cards.forEach((c) => {
      if (c.isConnected) c.style.transition = '';
    });
  }, 450);
}

// ─── EVENTS FEED (More Events view) ──────────────────────
const EVENTS_API = 'https://news.csun.edu/wp-json/csunfeeds/v1/events-feed/career-center';

function stripHtml(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent || d.innerText || '';
}

// The feed returns `featured_image` as an OBJECT with .url + .sizes, not a string.
// Pick the best available size in order of preference.
function getEventImage(ev) {
  const fi = ev.featured_image;
  if (fi && typeof fi === 'object') {
    return (fi.sizes && (fi.sizes.medium?.url || fi.sizes.large?.url || fi.sizes.full?.url))
        || fi.url
        || '';
  }
  if (typeof fi === 'string') return fi;
  return ev.image || ev.thumbnail || '';
}

// Try hardest to return a JS Date from whatever the feed supplies.
function getEventStartDate(ev) {
  const raw = ev.event_object?.start_date
           || ev.event_object?.dates?.start?.date
           || ev.start_date
           || ev.published_date
           || ev.date
           || '';
  if (!raw) return null;
  // "2026-04-21 10:00:00" needs to be normalized for Safari
  const normalized = typeof raw === 'string' ? raw.replace(' ', 'T') : raw;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

function formatEventDate(d) {
  if (!d) return '';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatEventTime(d) {
  if (!d) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function getEventTitle(ev) {
  return stripHtml(ev.title || ev.event_object?.post_title || '');
}

function getEventVenue(ev) {
  const v = ev.event_object?.venues?.[0];
  if (!v) return '';
  return v.post_title || '';
}

function getEventCost(ev) {
  const c = ev.event_object?.cost;
  if (!c) return '';
  return c;
}

// The feed's `content` field is the full HTML (with embedded images and links).
// We want to keep images + basic formatting but strip anything dangerous.
function sanitizeContentHtml(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  const ALLOWED = new Set([
    'P','BR','STRONG','B','EM','I','U','SPAN','DIV',
    'UL','OL','LI','A','IMG','H1','H2','H3','H4','H5','H6',
    'HR','BLOCKQUOTE'
  ]);

  const walk = (node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === 1) { // element
        const tag = child.tagName;
        if (!ALLOWED.has(tag)) {
          // Replace with its text content, preserving inner markup we do allow.
          while (child.firstChild) node.insertBefore(child.firstChild, child);
          node.removeChild(child);
          continue;
        }
        // Strip all attributes except a safe subset per tag
        const attrs = Array.from(child.attributes);
        for (const a of attrs) {
          const name = a.name.toLowerCase();
          const keep =
            (tag === 'A' && (name === 'href' || name === 'title')) ||
            (tag === 'IMG' && (name === 'src' || name === 'alt' || name === 'width' || name === 'height'));
          if (!keep) child.removeAttribute(a.name);
        }
        // Force images to load lazily and constrain size via CSS in the modal.
        if (tag === 'IMG') {
          const src = child.getAttribute('src') || '';
          if (src.startsWith('javascript:') || src.startsWith('data:text')) child.remove();
          else child.setAttribute('loading', 'lazy');
          continue;
        }
        if (tag === 'A') {
          // Links are non-clickable inside the kiosk (CSS pointer-events:none),
          // but still neutralize javascript:.
          const href = child.getAttribute('href') || '';
          if (href.startsWith('javascript:')) child.removeAttribute('href');
        }
        walk(child);
      } else if (child.nodeType === 8) { // comment
        node.removeChild(child);
      }
    }
  };
  walk(root);
  return root.innerHTML;
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

    clearChildren(els.eventsGrid);

    events.slice(0, 24).forEach((ev) => {
      const card = document.createElement('article');
      card.className = 'event-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');

      const imgUrl = getEventImage(ev);
      const imgEl = document.createElement('div');
      if (imgUrl) {
        imgEl.className = 'event-card__img';
        imgEl.style.backgroundImage = `url("${imgUrl.replace(/"/g, '\\"')}")`;
      } else {
        imgEl.className = 'event-card__img event-card__img--placeholder';
        imgEl.innerHTML = '<svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="#ccc" stroke-width="2"><rect x="4" y="8" width="40" height="32" rx="3"/><path d="M4 18h40"/><circle cx="14" cy="13" r="2" fill="#ccc"/><circle cx="34" cy="13" r="2" fill="#ccc"/></svg>';
      }
      card.appendChild(imgEl);

      const body = document.createElement('div');
      body.className = 'event-card__body';

      const start = getEventStartDate(ev);
      if (start) {
        const dateEl = document.createElement('div');
        dateEl.className = 'event-card__date';
        dateEl.textContent = formatEventDate(start);
        body.appendChild(dateEl);

        const timeEl = document.createElement('div');
        timeEl.className = 'event-card__time';
        timeEl.textContent = formatEventTime(start);
        body.appendChild(timeEl);
      }

      const title = getEventTitle(ev);
      if (title) {
        const h = document.createElement('h3');
        h.className = 'event-card__title';
        h.textContent = title;
        body.appendChild(h);
      }

      const excerptSrc = ev.excerpt || ev.event_object?.excerpt || ev.content || '';
      if (excerptSrc) {
        const p = document.createElement('p');
        p.className = 'event-card__desc';
        const text = stripHtml(excerptSrc).replace(/Continue reading.*$/i, '').trim();
        p.textContent = text.length > 140 ? text.slice(0, 140).trimEnd() + '…' : text;
        body.appendChild(p);
      }

      const hint = document.createElement('div');
      hint.className = 'event-card__tap-hint';
      hint.textContent = 'Tap for details →';
      body.appendChild(hint);

      card.appendChild(body);

      const open = () => openEventDetail(ev);
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });

      els.eventsGrid.appendChild(card);
    });
  } catch (err) {
    console.error('Events load error', err);
    if (els.eventsLoading) els.eventsLoading.style.display = 'none';
    els.eventsGrid.innerHTML = '<p class="events-empty">Unable to load events at this time.</p>';
  }
}

// ─── EVENT DETAIL MODAL ──────────────────────────────────
function openEventDetail(ev) {
  if (!els.eventModal) return;

  // Hero image
  const heroUrl = getEventImage(ev);
  if (heroUrl) {
    els.eventModalHero.classList.remove('is-empty');
    els.eventModalHero.style.backgroundImage = `url("${heroUrl.replace(/"/g, '\\"')}")`;
  } else {
    els.eventModalHero.classList.add('is-empty');
    els.eventModalHero.style.backgroundImage = '';
  }

  // Date / time pill
  const start = getEventStartDate(ev);
  const plain = ev.event_object?.plain_schedule_details;
  els.eventModalDate.textContent =
    plain || (start ? `${formatEventDate(start)} · ${formatEventTime(start)}` : 'Date TBA');

  // Venue pill
  const venue = getEventVenue(ev);
  if (venue) {
    els.eventModalVenue.textContent = venue;
    els.eventModalVenue.classList.remove('is-hidden');
  } else {
    els.eventModalVenue.classList.add('is-hidden');
  }

  // Cost pill
  const cost = getEventCost(ev);
  if (cost) {
    els.eventModalCost.textContent = /free/i.test(cost) ? `Free` : `${cost}`;
    els.eventModalCost.classList.remove('is-hidden');
  } else {
    els.eventModalCost.classList.add('is-hidden');
  }

  // Title
  els.eventModalTitle.textContent = getEventTitle(ev);

  // Content (full HTML with embedded images), sanitized
  const contentHtml = ev.content || ev.event_object?.post_content || '';
  els.eventModalContent.innerHTML = sanitizeContentHtml(contentHtml);

  els.eventModalScroll.scrollTop = 0;
  els.eventModal.classList.remove('is-hidden');
  els.app.classList.add('is-modal-open');
}

function closeEventDetail() {
  if (!els.eventModal) return;
  els.eventModal.classList.add('is-hidden');
  els.app.classList.remove('is-modal-open');
  // Free image memory
  els.eventModalHero.style.backgroundImage = '';
  els.eventModalContent.innerHTML = '';
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
const PROXY_FETCH_TIMEOUT_MS = 22_000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchThroughProxy(url) {
  const { available } = await resolveApiBase();
  if (available) {
    try {
      const res = await fetchWithTimeout(
        await apiUrl(`/api/proxy?url=${encodeURIComponent(url)}`),
        { cache: 'no-store' },
      );
      if (res.ok) {
        const html = await res.text();
        if (html && html.length >= 200) return html;
      }
    } catch {
      /* fall through to public proxies */
    }
  }

  const proxies = URL_CONFIG.corsProxies || [];
  let lastErr;
  for (const build of proxies) {
    try {
      const proxyUrl = build(url);
      const res = await fetchWithTimeout(proxyUrl, { cache: 'no-store' });
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

  // Drop any author viewport so we can apply a kiosk-friendly scale (portrait TVs
  // otherwise render the page like an oversized phone).
  out = out.replace(/<meta[^>]+name=["']viewport["'][^>]*>/gi, '');

  // Inject <base> + viewport so relative assets resolve and text fits the iframe.
  const baseTag = `<base href="${baseUrl}">`;
  const kioskViewport =
    '<meta name="viewport" content="width=device-width, initial-scale=0.72, minimum-scale=0.45, maximum-scale=2.5, viewport-fit=cover">';
  const headInject = `\n${baseTag}\n${kioskViewport}\n`;
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (m) => `${m}${headInject}`);
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html[^>]*>/i, (m) => `${m}<head>${baseTag}${kioskViewport}</head>`);
  } else {
    out = `<head>${baseTag}${kioskViewport}</head>${out}`;
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

const VIEWPORT_DEFAULT = 'width=device-width, initial-scale=1.0, viewport-fit=cover';
const VIEWPORT_MAP_NO_ZOOM =
  'width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

function setShellZoomForMap(active) {
  const meta = document.getElementById('viewport-meta');
  if (meta) meta.setAttribute('content', active ? VIEWPORT_MAP_NO_ZOOM : VIEWPORT_DEFAULT);
  document.documentElement.classList.toggle('kiosk-map-active', Boolean(active));
}

async function prefetchWebContent(url) {
  if (state.webHtmlCache[url]) return;
  try {
    const html = await fetchThroughProxy(url);
    state.webHtmlCache[url] = rewriteHtmlForFraming(html, url);
  } catch {
    /* prefetch is best-effort */
  }
}

async function loadIntoFrame({ url, frame, loadingEl, fallbackEl, stateKey }) {
  state.webLoadState[stateKey] = 'loading';
  if (loadingEl) loadingEl.classList.remove('is-hidden');
  if (fallbackEl) fallbackEl.classList.add('is-hidden');
  frame.classList.remove('is-hidden');

  const applySrcdoc = (html) => {
    frame.removeAttribute('src');
    frame.srcdoc = html;
    if (loadingEl) loadingEl.classList.add('is-hidden');
    state.webLoadState[stateKey] = 'ready';
  };

  if (state.webHtmlCache[url]) {
    applySrcdoc(state.webHtmlCache[url]);
    return;
  }

  try {
    const html = await fetchThroughProxy(url);
    const rewritten = rewriteHtmlForFraming(html, url);
    state.webHtmlCache[url] = rewritten;
    applySrcdoc(rewritten);
  } catch (err) {
    console.warn('[kiosk] proxy load failed', err);
    if (loadingEl) loadingEl.classList.add('is-hidden');
    frame.classList.add('is-hidden');
    if (fallbackEl) fallbackEl.classList.remove('is-hidden');
    state.webLoadState[stateKey] = 'error';
  }
}

function ensureWebsiteLoaded() {
  if (state.webLoadState.website === 'ready') return;
  if (state.webLoadState.website === 'loading') return;
  loadIntoFrame({
    url: URL_CONFIG.website,
    frame: els.websiteFrame,
    loadingEl: els.webLoading,
    fallbackEl: els.webFallback,
    stateKey: 'website',
  });
}

function ensurePartnersLoaded() {
  if (state.webLoadState.partners === 'ready') return;
  if (state.webLoadState.partners === 'loading') return;
  loadIntoFrame({
    url: URL_CONFIG.partners,
    frame: els.partnersFrame,
    loadingEl: els.partnersLoading,
    fallbackEl: els.partnersFallback,
    stateKey: 'partners',
  });
}

// ─── CHECK IN ────────────────────────────────────────────
// Interactive forms (Monday, Typeform, etc.) load in a single iframe when
// possible. Android kiosk shells (Fully Kiosk Browser, WebView wrappers) often
// block cross-origin iframes with ERR_BLOCKED_BY_RESPONSE — we detect that
// environment and fall back to proxy + srcdoc, then full-page navigation.

function isRestrictedEmbedShell() {
  const ua = navigator.userAgent || '';
  if (/Fully Kiosk|FullyKiosk/i.test(ua)) return true;
  if (typeof window.fully === 'object' && window.fully !== null) return true;
  // Android System WebView marker (inside apps — not Chrome browser).
  if (/Android/i.test(ua) && /; wv\)/i.test(ua)) return true;
  return false;
}

function parseCheckInEmbed(embedHtml) {
  const trimmed = String(embedHtml || '').trim();
  if (!trimmed) return { url: '', rawHtml: '' };
  const iframeSrc = trimmed.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  if (iframeSrc) return { url: iframeSrc[1], rawHtml: '' };
  const anySrc = trimmed.match(/\ssrc=["']([^"']+)["']/i);
  if (anySrc) return { url: anySrc[1], rawHtml: '' };
  return { url: '', rawHtml: trimmed };
}

function normalizeCheckInUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'forms.monday.com' || u.hostname.endsWith('.monday.com')) {
      if (!u.searchParams.has('embed')) u.searchParams.set('embed', 'true');
    }
    return u.toString();
  } catch {
    return url;
  }
}

function prefersTopLevelCheckIn(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'forms.monday.com' || host.endsWith('.monday.com');
  } catch {
    return false;
  }
}

function resolveCheckInTarget() {
  const { mode, url, embed } = state.checkIn;
  if (mode === 'embed' && embed && embed.trim()) {
    const parsed = parseCheckInEmbed(embed);
    if (parsed.url) {
      return { url: normalizeCheckInUrl(parsed.url), rawHtml: '' };
    }
    return { url: '', rawHtml: parsed.rawHtml };
  }
  if (url && url.trim()) {
    return { url: normalizeCheckInUrl(url.trim()), rawHtml: '' };
  }
  return { url: '', rawHtml: '' };
}

function showCheckInLoading(message = 'Loading check-in…') {
  if (els.checkinLoading) {
    const label = els.checkinLoading.querySelector('span');
    if (label) label.textContent = message;
    els.checkinLoading.classList.remove('is-hidden');
  }
}

function hideCheckInLoading() {
  els.checkinLoading?.classList.add('is-hidden');
}

function hideCheckInFallback() {
  els.checkinFallback?.classList.add('is-hidden');
}

function resetCheckInFrame() {
  if (!els.checkinFrame) return;
  els.checkinFrame.removeAttribute('srcdoc');
  els.checkinFrame.removeAttribute('src');
}

function openCheckInTopLevel(url) {
  const target = normalizeCheckInUrl(url);
  showCheckInLoading('Opening check-in form…');
  hideCheckInFallback();
  window.setTimeout(() => {
    window.location.assign(target);
  }, 350);
}

function showCheckInFallback(url, { autoOpenMs = 0 } = {}) {
  hideCheckInLoading();
  els.checkinFrame?.classList.add('is-hidden');
  els.checkinEmbed?.classList.add('is-hidden');
  if (els.checkinFallbackUrl) els.checkinFallbackUrl.textContent = url;
  if (els.checkinOpenBtn) {
    els.checkinOpenBtn.onclick = () => openCheckInTopLevel(url);
  }
  els.checkinFallback?.classList.remove('is-hidden');
  state.checkInLoadState = 'error';
  if (autoOpenMs > 0 && isRestrictedEmbedShell()) {
    window.setTimeout(() => openCheckInTopLevel(url), autoOpenMs);
  }
}

function attemptDirectCheckInFrame(url, timeoutMs = 3000) {
  return new Promise((resolve) => {
    if (!els.checkinFrame) {
      resolve(false);
      return;
    }

    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      els.checkinFrame.removeEventListener('load', onLoad);
      resolve(ok);
    };

    const onLoad = () => finish(true);
    const timer = window.setTimeout(() => finish(false), timeoutMs);

    resetCheckInFrame();
    els.checkinFrame.classList.remove('is-hidden');
    els.checkinFrame.addEventListener('load', onLoad);
    els.checkinFrame.src = url;
  });
}

async function attemptProxiedCheckInFrame(url) {
  if (!els.checkinFrame) return false;
  try {
    const html = await fetchThroughProxy(url);
    const rewritten = rewriteHtmlForFraming(html, url);
    resetCheckInFrame();
    els.checkinFrame.srcdoc = rewritten;
    els.checkinFrame.classList.remove('is-hidden');
    return true;
  } catch {
    return false;
  }
}

async function loadCheckInUrl(url) {
  const normalized = normalizeCheckInUrl(url);
  if (
    state.checkInLoadState === 'ready'
    && state.checkInTargetUrl === normalized
    && (els.checkinFrame?.getAttribute('src') === normalized || els.checkinFrame?.srcdoc)
  ) {
    return;
  }
  state.checkInTargetUrl = normalized;
  state.checkInLoadState = 'loading';
  hideCheckInFallback();
  els.checkinEmpty?.classList.add('is-hidden');
  els.checkinEmbed?.classList.add('is-hidden');
  if (els.checkinEmbed) els.checkinEmbed.innerHTML = '';
  showCheckInLoading('Loading check-in…');

  if (isRestrictedEmbedShell() && prefersTopLevelCheckIn(normalized)) {
    openCheckInTopLevel(normalized);
    return;
  }

  if (!isRestrictedEmbedShell()) {
    resetCheckInFrame();
    els.checkinFrame?.classList.remove('is-hidden');
    if (els.checkinFrame) els.checkinFrame.src = normalized;
    hideCheckInLoading();
    state.checkInLoadState = 'ready';
    state.checkInLoaded = true;
    return;
  }

  // Fully Kiosk / Android WebView: nested and cross-origin iframes are often
  // blocked even when desktop browsers allow them.
  const directOk = await attemptDirectCheckInFrame(normalized, 2800);
  if (directOk) {
    hideCheckInLoading();
    state.checkInLoadState = 'ready';
    state.checkInLoaded = true;
    return;
  }

  showCheckInLoading('Trying alternate load…');
  const proxyOk = await attemptProxiedCheckInFrame(normalized);
  if (proxyOk) {
    hideCheckInLoading();
    state.checkInLoadState = 'ready';
    state.checkInLoaded = true;
    return;
  }

  showCheckInFallback(normalized, { autoOpenMs: 3500 });
}

function loadCheckInRawEmbed(rawHtml) {
  state.checkInLoadState = 'loading';
  hideCheckInFallback();
  els.checkinEmpty?.classList.add('is-hidden');
  hideCheckInLoading();
  resetCheckInFrame();
  els.checkinFrame?.classList.add('is-hidden');

  if (els.checkinEmbed) {
    els.checkinEmbed.innerHTML = rawHtml;
    activateEmbeddedScripts(els.checkinEmbed);

    // Hoist nested iframe src into the main frame (Android WebView fix).
    const nested = els.checkinEmbed.querySelector('iframe[src]');
    if (nested && isRestrictedEmbedShell()) {
      const nestedUrl = nested.getAttribute('src');
      els.checkinEmbed.innerHTML = '';
      if (nestedUrl) {
        loadCheckInUrl(nestedUrl);
        return;
      }
    }
  }

  els.checkinEmbed?.classList.remove('is-hidden');
  state.checkInLoadState = 'ready';
  state.checkInLoaded = true;
}

function renderCheckIn() {
  if (!els.viewCheckin) return;
  const target = resolveCheckInTarget();

  if (!target.url && !target.rawHtml) {
    resetCheckInFrame();
    if (els.checkinEmbed) els.checkinEmbed.innerHTML = '';
    els.checkinFrame?.classList.add('is-hidden');
    els.checkinEmbed?.classList.add('is-hidden');
    hideCheckInFallback();
    hideCheckInLoading();
    els.checkinEmpty?.classList.remove('is-hidden');
    state.checkInLoaded = false;
    state.checkInLoadState = 'idle';
    return;
  }

  els.checkinEmpty?.classList.add('is-hidden');
  if (target.url) {
    loadCheckInUrl(target.url);
    return;
  }
  loadCheckInRawEmbed(target.rawHtml);
}

// Inserting an embed snippet via innerHTML does NOT execute its <script> tags.
// Re-create them so provider widget loaders (Monday, Typeform, etc.) run.
function activateEmbeddedScripts(container) {
  if (!container) return;
  container.querySelectorAll('script').forEach((old) => {
    const fresh = document.createElement('script');
    for (const attr of old.attributes) fresh.setAttribute(attr.name, attr.value);
    fresh.text = old.textContent || '';
    old.replaceWith(fresh);
  });
}

function ensureCheckInLoaded() {
  const target = resolveCheckInTarget();
  const normalized = target.url ? normalizeCheckInUrl(target.url) : '';
  if (
    state.checkInLoaded
    && state.checkInLoadState === 'ready'
    && (normalized ? state.checkInTargetUrl === normalized : Boolean(target.rawHtml))
  ) {
    return;
  }
  renderCheckIn();
}

// ─── VIEW SWITCHING ──────────────────────────────────────
function setView(viewId) {
  if (!VIEWS[viewId]) return;

  const previousView = state.activeView;

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
  updateHeaderContext(viewId);

  if (viewId !== 'map') closeMobileMapModal();

  // Map view: lock OS/browser pinch-zoom to the page shell so only the map iframe zooms.
  setShellZoomForMap(viewId === 'map');

  // Load content lazily
  if (viewId === 'map' && !state.mapLoaded) {
    els.mappedinFrame.src = getMapUrl();
    state.mapLoaded = true;
  }
  if (viewId === 'website') {
    if (state.webLoadState.website === 'error') state.webLoadState.website = 'idle';
    ensureWebsiteLoaded();
  }
  if (viewId === 'partners') {
    if (state.webLoadState.partners === 'error') state.webLoadState.partners = 'idle';
    ensurePartnersLoaded();
  }
  if (viewId === 'info') loadEvents();
  if (viewId === 'jobs') loadJobsPage();
  if (viewId === 'checkin') ensureCheckInLoaded();

  // Inactivity + popup scheduling
  if (viewId === 'home') {
    if (previousView === 'jobs') resetJobsSession();
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
  closeMobileMapModal();
  closeEventDetail();
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
  const msLeft = expiresAt - Date.now();
  const s = Math.max(0, Math.ceil(msLeft / 1000));
  const totalS = TIMING_CONFIG.inactivityTimeoutMs / 1000;
  const progress = Math.min(1, Math.max(0, s / totalS));

  if (els.countdownPillLabel) els.countdownPillLabel.textContent = `Home in ${s}s`;
  else if (els.countdownPill) els.countdownPill.textContent = `Home in ${s}s`;

  if (els.countdownRingProgress) {
    els.countdownRingProgress.style.strokeDasharray = `${COUNTDOWN_RING_CIRCUMFERENCE}`;
    els.countdownRingProgress.style.strokeDashoffset = `${COUNTDOWN_RING_CIRCUMFERENCE * (1 - progress)}`;
  }

  if (els.countdownPill) {
    els.countdownPill.classList.toggle('kiosk-header__countdown--warning', s > 0 && s <= 10);
  }
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

function openMobileMapModal() {
  if (!els.mobileMapPopup) return;
  closePopup();
  closeEventDetail();
  els.mobileMapPopup.classList.remove('is-hidden');
  els.app.classList.add('is-modal-open');
}

function closeMobileMapModal() {
  if (!els.mobileMapPopup) return;
  els.mobileMapPopup.classList.add('is-hidden');
  els.app.classList.remove('is-modal-open');
}

function schedulePopup() {
  clearPopupTimers();
  if (state.sessionPopupShown || state.activeView === 'home') return;
  state.popupTimer = setTimeout(() => showPopup(), TIMING_CONFIG.popupDelayMs);
}

// ─── EVENT BINDING ───────────────────────────────────────
function bindEvents() {
  if (els.startButton) els.startButton.addEventListener('click', () => setView('map'));
  if (els.kioskHeroMapBtn) els.kioskHeroMapBtn.addEventListener('click', () => setView('map'));

  document.querySelectorAll('[data-view-link]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.viewLink;
      if (view) setView(view);
    });
  });

  document.querySelectorAll('.sidebar-item[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  if (els.closePopupButton) els.closePopupButton.addEventListener('click', () => { closePopup(); setView('map'); });
  if (els.instagramCloseX)  els.instagramCloseX.addEventListener('click', closePopup);
  if (els.popup) els.popup.addEventListener('click', (e) => { if (e.target === els.popup) closePopup(); });

  if (els.instagramQrImage) {
    els.instagramQrImage.addEventListener('error', () => {
      els.instagramQrImage.classList.add('is-hidden');
      els.instagramQrFallback?.classList.remove('is-hidden');
    });
  }

  if (els.mobileMapQrImage) {
    els.mobileMapQrImage.addEventListener('error', () => {
      els.mobileMapQrImage.classList.add('is-hidden');
      els.mobileMapQrFallback?.classList.remove('is-hidden');
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (els.popup && !els.popup.classList.contains('is-hidden')) {
      closePopup();
      return;
    }
    if (els.mobileMapPopup && !els.mobileMapPopup.classList.contains('is-hidden')) {
      closeMobileMapModal();
    }
  });

  // Event detail modal
  if (els.eventModalClose) els.eventModalClose.addEventListener('click', closeEventDetail);
  if (els.eventModal) els.eventModal.addEventListener('click', (e) => {
    if (e.target === els.eventModal) closeEventDetail();
  });

  // Header home button (visible only in map view via CSS)
  if (els.topbarHomeBtn) els.topbarHomeBtn.addEventListener('click', () => goHome());

  if (els.topbarMobileMapBtn) els.topbarMobileMapBtn.addEventListener('click', openMobileMapModal);
  if (els.mobileMapCloseX) els.mobileMapCloseX.addEventListener('click', closeMobileMapModal);
  if (els.mobileMapPopup) {
    els.mobileMapPopup.addEventListener('click', (e) => {
      if (e.target === els.mobileMapPopup) closeMobileMapModal();
    });
  }

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

  // Re-measure partner marquee on resize (debounced)
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (state.partnerLogos.length) renderPartnerRow();
    }, 200);
  });
}

// ─── LOAD LOGOS ──────────────────────────────────────────
// Every kiosk reads the same logos directly from the repo. The /admin
// dashboard commits changes to the repo so updates land everywhere at once.
async function loadLogos({ forceRefresh = false } = {}) {
  if (forceRefresh) {
    try {
      localStorage.removeItem(getCacheKey(LOGO_CONFIG.attendeeDir));
      localStorage.removeItem(getCacheKey(LOGO_CONFIG.partnerDir));
    } catch { /* ignore */ }
  }
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
  if (!state.attendeeLogos.length && !state.partnerLogos.length && !forceRefresh) {
    await loadLogos({ forceRefresh: true });
    return;
  }
  buildTicker();
  renderPartnerRow();
  updateHomeStats();
}

// ─── LOAD RUNTIME CONFIG ─────────────────────────────────
// config.json at the repo root is the source of truth for admin-managed
// settings (currently: map URL + a version counter). The kiosk picks it
// up at boot; admins bump the version with every commit so any logo
// listings cached in localStorage also get invalidated.
async function loadRuntimeConfig() {
  try {
    const cfg = await loadConfig();
    state.configVersion = cfg.version || 0;
    if (cfg.mapUrl) state.mapUrlOverride = cfg.mapUrl;
    applyHeroBackground(cfg.homepageBackground);
    applyMobileMapQr(cfg.mobileMapQr);
    state.checkIn = {
      mode: cfg.checkInMode === 'embed' ? 'embed' : 'url',
      url: cfg.checkInUrl || '',
      embed: cfg.checkInEmbed || '',
    };
    renderCheckIn();
    state.idleAdPlayer?.checkRemoteTestTrigger?.();
  } catch (err) {
    console.warn('config.json unavailable; using bundled defaults.', err);
    applyHeroBackground('');
    renderCheckIn();
  }
}

// Apply an admin-uploaded mobile-map QR image (with cache-bust). Falls back to
// the bundled asset path if no override is set in config.json.
function applyMobileMapQr(path) {
  if (!els.mobileMapQrImage) return;
  const target = path && path.trim() ? path.trim() : 'assets/qr/mobile-map.png';
  const url = resolveAssetUrl(target);
  if (!url) return;
  const sep = url.includes('?') ? '&' : '?';
  els.mobileMapQrImage.classList.remove('is-hidden');
  els.mobileMapQrFallback?.classList.add('is-hidden');
  els.mobileMapQrImage.src = `${url}${sep}v=${state.configVersion || Date.now()}`;
}

// ─── INIT ────────────────────────────────────────────────
async function init() {
  applyCopy();
  initJobsPage(getJobsPageElements(), () => {
    if (state.activeView !== 'home') resetInactivityTimer();
  });
  state.idleAdPlayer = initIdleAdPlayer({
    overlay: document.getElementById('idle-ad-overlay'),
    mediaEl: document.getElementById('idle-ad-media'),
  });
  bindEvents();
  await loadRuntimeConfig();
  await startClock();
  await loadLogos();
  prefetchWebContent(URL_CONFIG.website);
  prefetchWebContent(URL_CONFIG.partners);
  setView('home');
}

init();
