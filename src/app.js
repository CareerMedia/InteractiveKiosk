import { EVENT_CONFIG } from './config/event.js';
import { LOGO_CONFIG } from './config/logos.js';
import { MAP_CONFIG } from './config/map.js';
import { POPUP_CONFIG } from './config/popup.js';
import { TIMING_CONFIG } from './config/timing.js';
import { URL_CONFIG } from './config/urls.js';
import { loadConfig } from './shared/config.js';

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
  mapUrlOverride: null,
  configVersion: 0,
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
  partnerTrack:       document.getElementById('partner-track'),
  partnerScrollShell: document.getElementById('partner-scroll-shell'),
  tickerGrid:         document.getElementById('ticker-grid'),
  tickerShell:        document.getElementById('logo-ticker-shell'),

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

  // Controls (extra)
  topbarHomeBtn:      document.getElementById('topbar-home-btn'),

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
  // Admin override (from /admin) wins over the bundled default.
  const base = state.mapUrlOverride || MAP_CONFIG.embedUrl;
  let url;
  try {
    url = new URL(base);
  } catch {
    return base;
  }
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
  // Include the admin-managed config version so every new admin commit
  // automatically invalidates previously-cached logo listings.
  return `kiosk-logo-cache:${owner}:${repo}:${branch}:v${state.configVersion}:${dir}`;
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

// ─── OUR EMPLOYER PARTNERS ───────────────────────────────
// Row is centered by default. If the logos overflow the shell, clone the row
// and kick off a seamless left→right marquee.
function buildPartnerCards(target) {
  state.partnerLogos.forEach((logo) => {
    const card = document.createElement('div');
    card.className = 'partner-logo-card';
    const img = document.createElement('img');
    img.src = logo.src;
    img.alt = logo.name;
    img.loading = 'lazy';
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

// ─── PARTICIPATING EMPLOYERS — 5-column vertical marquee ──
// Distributes logos round-robin across N columns, duplicates each column's
// list for a seamless top→bottom scroll. Built to handle ~100 logos.
const TICKER_COLUMNS = 5;
const TICKER_SIZES = ['ticker-card--lg', 'ticker-card--md', 'ticker-card--sm'];

function makeTickerCard(logo, index) {
  const card = document.createElement('div');
  // Rotate sizes so the cards look rhythmic, not uniform
  const sizeCls = TICKER_SIZES[index % TICKER_SIZES.length];
  const isHiring = index % 11 === 3; // sprinkle a few green "HIRING" chips
  card.className = `ticker-card ${sizeCls}${isHiring ? ' ticker-card--hiring' : ''}`;
  // stagger the shimmer so cards flash at different times
  card.style.setProperty('--card-shimmer-delay', `${(index % 7) * 0.9}s`);

  const logoWrap = document.createElement('div');
  logoWrap.className = 'ticker-card__logo';
  const img = document.createElement('img');
  img.src = logo.src;
  img.alt = logo.name;
  img.loading = 'lazy';
  logoWrap.appendChild(img);
  card.appendChild(logoWrap);

  const nameEl = document.createElement('div');
  nameEl.className = 'ticker-card__name';
  nameEl.textContent = logo.name;
  card.appendChild(nameEl);

  if (isHiring) {
    const chip = document.createElement('span');
    chip.className = 'ticker-card__chip';
    chip.textContent = 'Hiring';
    card.appendChild(chip);
  }

  return card;
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

    // Build two identical stacks for seamless looping (-50% translate)
    [0, 1].forEach(() => {
      logos.forEach((logo, i) => {
        track.appendChild(makeTickerCard(logo, i + colIndex));
      });
    });

    col.appendChild(track);
    els.tickerGrid.appendChild(col);
  });
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
  if (els.instagramCloseX)  els.instagramCloseX.addEventListener('click', closePopup);
  if (els.popup) els.popup.addEventListener('click', (e) => { if (e.target === els.popup) closePopup(); });

  // Event detail modal
  if (els.eventModalClose) els.eventModalClose.addEventListener('click', closeEventDetail);
  if (els.eventModal) els.eventModal.addEventListener('click', (e) => {
    if (e.target === els.eventModal) closeEventDetail();
  });

  // Header home button (visible only in map view via CSS)
  if (els.topbarHomeBtn) els.topbarHomeBtn.addEventListener('click', () => goHome());

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
  } catch (err) {
    console.warn('config.json unavailable; using bundled defaults.', err);
  }
}

// ─── INIT ────────────────────────────────────────────────
async function init() {
  applyCopy();
  bindEvents();
  await loadRuntimeConfig();
  loadLogos();
  setView('home');
}

init();
