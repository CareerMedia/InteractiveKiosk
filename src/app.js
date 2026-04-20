import { EVENT_CONFIG } from './config/event.js';
import { LOGO_CONFIG } from './config/logos.js';
import { MAP_CONFIG } from './config/map.js';
import { POPUP_CONFIG } from './config/popup.js';
import { TIMING_CONFIG } from './config/timing.js';

const state = {
  currentView: 'home',
  sessionActive: false,
  inactivityTimer: null,
  countdownTimer: null,
  popupTimer: null,
  popupAutoCloseTimer: null,
  sessionPopupShown: false,
  attendeeLogos: [],
  partnerLogos: [],
};

const els = {
  app: document.getElementById('app'),
  eventLabelPill: document.getElementById('event-label-pill'),
  eventDate: document.getElementById('event-date'),
  homeHeroTitle: document.getElementById('home-hero-title'),
  homeHeroCopy: document.getElementById('home-hero-copy'),
  ctaText: document.getElementById('cta-text'),
  footerLabel: document.getElementById('footer-label'),
  footerBar: document.getElementById('footer-bar'),
  startButton: document.getElementById('start-button'),
  footerSecondaryButton: document.getElementById('footer-secondary-button'),
  panelHomeButton: document.getElementById('panel-home-button'),
  returnHomeButton: document.getElementById('return-home-button'),
  restartSessionButton: document.getElementById('restart-session-button'),
  countdownPill: document.getElementById('countdown-pill'),
  mapToolbarTitle: document.getElementById('map-toolbar-title'),
  mappedinFrame: document.getElementById('mappedin-frame'),
  logoMarqueeTrack: document.getElementById('logo-marquee-track'),
  partnerShowcase: document.getElementById('partner-showcase'),
  menuRail: document.getElementById('menu-rail'),
  menuItems: Array.from(document.querySelectorAll('.menu-item')),
  viewHome: document.getElementById('view-home'),
  viewPanel: document.getElementById('view-panel'),
  mapStage: document.getElementById('map-stage'),
  panelKicker: document.getElementById('panel-kicker'),
  panelTitle: document.getElementById('panel-title'),
  panelCopy: document.getElementById('panel-copy'),
  browserPanel: document.getElementById('browser-panel'),
  browserUrl: document.getElementById('browser-url'),
  browserWebview: document.getElementById('browser-webview'),
  browserFallback: document.getElementById('browser-fallback'),
  browserFallbackBody: document.getElementById('browser-fallback-body'),
  openExternalButton: document.getElementById('open-external-button'),
  openExternalFallback: document.getElementById('open-external-fallback'),
  infoGrid: document.getElementById('info-grid'),
  partnersGrid: document.getElementById('partners-grid'),
  popup: document.getElementById('instagram-popup'),
  confettiLayer: document.getElementById('confetti-layer'),
  closePopupButton: document.getElementById('close-popup-button'),
  instagramKicker: document.getElementById('instagram-kicker'),
  instagramTitle: document.getElementById('instagram-title'),
  instagramHeadline: document.getElementById('instagram-headline'),
  instagramHandle: document.getElementById('instagram-handle'),
  instagramBody: document.getElementById('instagram-body'),
  instagramLink: document.getElementById('instagram-link'),
};

function isElectron() {
  return navigator.userAgent.toLowerCase().includes('electron') || Boolean(window.kioskShell?.isElectron);
}

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
  if (!url.searchParams.has('kiosk')) url.searchParams.set('kiosk', 'true');
  return url.toString();
}

function getRepoContext() {
  const ownerFromHost = window.location.hostname.endsWith('.github.io')
    ? window.location.hostname.split('.')[0]
    : '';
  const repoFromPath = window.location.pathname.split('/').filter(Boolean)[0] || '';

  return {
    owner: LOGO_CONFIG.githubOwner || ownerFromHost,
    repo: LOGO_CONFIG.githubRepo || repoFromPath,
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
    const parsed = JSON.parse(raw);
    if (!parsed.expiresAt || Date.now() > parsed.expiresAt || !Array.isArray(parsed.items)) return null;
    return parsed.items;
  } catch {
    return null;
  }
}

function writeCache(dir, items) {
  try {
    localStorage.setItem(getCacheKey(dir), JSON.stringify({
      expiresAt: Date.now() + TIMING_CONFIG.logoCacheTtlMs,
      items,
    }));
  } catch {
    // ignore storage errors
  }
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
    .filter((entry) => entry.type === 'file')
    .filter((entry) => LOGO_CONFIG.supportedExtensions.includes((entry.name.split('.').pop() || '').toLowerCase()))
    .map((entry) => ({
      id: entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: formatName(entry.name),
      src: entry.download_url,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  writeCache(dir, items);
  return items;
}

function applyCopy() {
  els.eventLabelPill.textContent = EVENT_CONFIG.label;
  els.eventDate.textContent = EVENT_CONFIG.date;
  els.homeHeroTitle.textContent = EVENT_CONFIG.heroTitle;
  els.homeHeroCopy.textContent = EVENT_CONFIG.heroDescription;
  els.ctaText.textContent = EVENT_CONFIG.ctaText;
  els.footerLabel.textContent = EVENT_CONFIG.footerLabel;
  els.mapToolbarTitle.textContent = EVENT_CONFIG.mapToolbarTitle;
  els.instagramKicker.textContent = POPUP_CONFIG.kicker;
  els.instagramTitle.textContent = POPUP_CONFIG.title;
  els.instagramHeadline.textContent = POPUP_CONFIG.headline;
  els.instagramHandle.textContent = POPUP_CONFIG.handle;
  els.instagramBody.textContent = POPUP_CONFIG.body;
}

function setFooterMode(mode) {
  const secondaryVisible = mode === 'panel';
  els.footerSecondaryButton.classList.toggle('is-hidden', !secondaryVisible);

  if (mode === 'home') {
    els.footerLabel.textContent = EVENT_CONFIG.footerLabel;
    els.ctaText.textContent = EVENT_CONFIG.ctaText;
    els.startButton.textContent = 'Start Here';
  } else if (mode === 'panel') {
    els.footerLabel.textContent = 'Navigation';
    els.ctaText.textContent = EVENT_CONFIG.returnMessage;
    els.startButton.textContent = 'Open Map';
  }
}

function setActiveMenu(view) {
  els.menuItems.forEach((item) => {
    item.classList.toggle('is-active', item.dataset.view === view);
  });
}

function renderPartnerShowcase() {
  clearChildren(els.partnerShowcase);

  if (!state.partnerLogos.length) {
    const hint = document.createElement('div');
    hint.className = 'partner-empty-hint';
    hint.innerHTML = 'Add partner logos to <code>assets/employers/partners/</code>';
    els.partnerShowcase.appendChild(hint);
    return;
  }

  state.partnerLogos.forEach((logo, index) => {
    const card = document.createElement('article');
    card.className = 'partner-card';
    card.style.animationDelay = `${index * 80}ms`;

    const img = document.createElement('img');
    img.src = logo.src;
    img.alt = logo.name;
    img.loading = 'lazy';

    const caption = document.createElement('div');
    caption.className = 'partner-card__label';
    caption.textContent = logo.name;

    card.append(img, caption);
    els.partnerShowcase.appendChild(card);
  });
}

function renderAttendeeMarquee() {
  clearChildren(els.logoMarqueeTrack);

  if (!state.attendeeLogos.length) {
    const empty = document.createElement('div');
    empty.className = 'ticker-empty';
    empty.textContent = 'Add attendee logos to assets/employers/attendees/';
    els.logoMarqueeTrack.appendChild(empty);
    return;
  }

  [0, 1].forEach(() => {
    const strip = document.createElement('div');
    strip.className = 'logo-strip';

    state.attendeeLogos.forEach((logo) => {
      const card = document.createElement('div');
      card.className = 'logo-card';

      const img = document.createElement('img');
      img.src = logo.src;
      img.alt = logo.name;
      img.loading = 'lazy';

      card.appendChild(img);
      strip.appendChild(card);
    });

    els.logoMarqueeTrack.appendChild(strip);
  });

  const duration = Math.max(38, state.attendeeLogos.length * 1.8);
  els.logoMarqueeTrack.style.setProperty('--marquee-duration', `${duration}s`);
  els.logoMarqueeTrack.classList.add('is-running');
}

function createInfoCard(item) {
  const card = document.createElement('article');
  card.className = 'info-card';

  const title = document.createElement('h3');
  title.className = 'info-card__title';
  title.textContent = item.title;

  const body = document.createElement('p');
  body.className = 'info-card__body';
  body.textContent = item.body;

  card.append(title, body);
  return card;
}

function configureBrowserPanel({ title, intro, url, fallbackText }) {
  els.panelTitle.textContent = title;
  els.panelCopy.textContent = intro;
  els.browserUrl.textContent = url;
  els.browserPanel.classList.remove('is-hidden');
  els.infoGrid.classList.add('is-hidden');
  els.partnersGrid.classList.add('is-hidden');
  els.browserFallbackBody.textContent = fallbackText;
  els.openExternalButton.onclick = () => openExternalUrl(url);
  els.openExternalFallback.onclick = () => openExternalUrl(url);

  if (isElectron()) {
    els.browserFallback.classList.add('is-hidden');
    els.browserWebview.classList.remove('is-hidden');
    if (els.browserWebview.getAttribute('src') !== url) {
      els.browserWebview.setAttribute('src', url);
    }
  } else {
    els.browserWebview.classList.add('is-hidden');
    els.browserFallback.classList.remove('is-hidden');
    els.browserWebview.removeAttribute('src');
  }
}

function renderInfoPanel() {
  els.panelKicker.textContent = EVENT_CONFIG.info.kicker;
  els.panelTitle.textContent = EVENT_CONFIG.info.title;
  els.panelCopy.textContent = EVENT_CONFIG.info.intro;
  els.browserPanel.classList.add('is-hidden');
  els.partnersGrid.classList.add('is-hidden');
  els.infoGrid.classList.remove('is-hidden');
  clearChildren(els.infoGrid);
  EVENT_CONFIG.info.cards.forEach((card) => els.infoGrid.appendChild(createInfoCard(card)));
}

function renderPartnersPanel() {
  els.panelKicker.textContent = EVENT_CONFIG.partners.kicker;
  configureBrowserPanel({
    title: EVENT_CONFIG.partners.title,
    intro: EVENT_CONFIG.partners.intro,
    url: MAP_CONFIG.partnersUrl,
    fallbackText: 'The included Electron kiosk shell can render the partner page in-app with a Chromium webview. In regular browser mode, use the button below to open it in a separate tab.',
  });

  els.partnersGrid.classList.remove('is-hidden');
  clearChildren(els.partnersGrid);

  if (!state.partnerLogos.length) {
    const hint = document.createElement('div');
    hint.className = 'partner-empty-hint';
    hint.innerHTML = 'Add partner logos to <code>assets/employers/partners/</code>';
    els.partnersGrid.appendChild(hint);
    return;
  }

  state.partnerLogos.forEach((logo) => {
    const card = document.createElement('article');
    card.className = 'mini-partner-card';

    const img = document.createElement('img');
    img.src = logo.src;
    img.alt = logo.name;
    img.loading = 'lazy';

    const label = document.createElement('div');
    label.className = 'mini-partner-card__label';
    label.textContent = logo.name;

    card.append(img, label);
    els.partnersGrid.appendChild(card);
  });
}

function renderWebsitePanel() {
  els.panelKicker.textContent = EVENT_CONFIG.website.kicker;
  configureBrowserPanel({
    title: EVENT_CONFIG.website.title,
    intro: EVENT_CONFIG.website.intro,
    url: MAP_CONFIG.websiteUrl,
    fallbackText: 'Standard web pages cannot bypass sites that block iframe embedding. The included Electron kiosk shell uses a Chromium webview for this panel.',
  });
}

function showHomeView() {
  state.currentView = 'home';
  state.sessionActive = false;
  state.sessionPopupShown = false;
  clearInactivityTimers();
  clearPopupTimers();
  closePopup();

  els.app.dataset.view = 'home';
  els.viewHome.classList.add('is-active');
  els.viewPanel.classList.remove('is-active');
  els.mapStage.classList.remove('is-active');
  els.footerBar.classList.remove('is-hidden');
  setActiveMenu('');
  setFooterMode('home');
  els.mappedinFrame.setAttribute('src', getMapUrl());
}

function schedulePopup() {
  clearPopupTimers();
  if (!state.sessionActive || state.sessionPopupShown) return;
  state.popupTimer = window.setTimeout(showPopup, TIMING_CONFIG.popupDelayMs);
}

function beginSessionIfNeeded() {
  if (state.sessionActive) return;
  state.sessionActive = true;
  state.sessionPopupShown = false;
  schedulePopup();
}

function setPanelView(view) {
  beginSessionIfNeeded();
  state.currentView = view;
  els.app.dataset.view = view;
  els.viewHome.classList.remove('is-active');
  els.viewPanel.classList.add('is-active');
  els.mapStage.classList.remove('is-active');
  els.footerBar.classList.remove('is-hidden');
  setFooterMode('panel');
  setActiveMenu(view);

  if (view === 'website') {
    renderWebsitePanel();
  } else if (view === 'info') {
    renderInfoPanel();
  } else if (view === 'partners') {
    renderPartnersPanel();
  }

  resetInactivityTimer();
}

function setMapView() {
  beginSessionIfNeeded();
  state.currentView = 'map';
  els.app.dataset.view = 'map';
  els.viewHome.classList.remove('is-active');
  els.viewPanel.classList.remove('is-active');
  els.mapStage.classList.add('is-active');
  els.footerBar.classList.add('is-hidden');
  setActiveMenu('map');
  if (!els.mappedinFrame.getAttribute('src')) {
    els.mappedinFrame.setAttribute('src', getMapUrl());
  }
  resetInactivityTimer();
}

function openView(view) {
  if (view === 'map') {
    setMapView();
    return;
  }
  if (view === 'website' || view === 'info' || view === 'partners') {
    setPanelView(view);
    return;
  }
  showHomeView();
}

function restartSession() {
  state.sessionPopupShown = false;
  clearPopupTimers();
  closePopup();
  els.mappedinFrame.setAttribute('src', getMapUrl());
  if (isElectron()) {
    if (els.browserWebview.getAttribute('src')) {
      els.browserWebview.setAttribute('src', els.browserWebview.getAttribute('src'));
    }
  }
  schedulePopup();
  resetInactivityTimer();
}

function clearInactivityTimers() {
  if (state.inactivityTimer) {
    clearTimeout(state.inactivityTimer);
    state.inactivityTimer = null;
  }
  if (state.countdownTimer) {
    clearInterval(state.countdownTimer);
    state.countdownTimer = null;
  }
}

function updateCountdown(expiresAt) {
  const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  els.countdownPill.textContent = `Home in ${seconds}s`;
}

function resetInactivityTimer() {
  if (!state.sessionActive || state.currentView === 'home') return;
  clearInactivityTimers();
  const expiresAt = Date.now() + TIMING_CONFIG.inactivityTimeoutMs;
  updateCountdown(expiresAt);
  state.countdownTimer = window.setInterval(() => updateCountdown(expiresAt), 1000);
  state.inactivityTimer = window.setTimeout(showHomeView, TIMING_CONFIG.inactivityTimeoutMs);
}

function clearPopupTimers() {
  if (state.popupTimer) {
    clearTimeout(state.popupTimer);
    state.popupTimer = null;
  }
  if (state.popupAutoCloseTimer) {
    clearTimeout(state.popupAutoCloseTimer);
    state.popupAutoCloseTimer = null;
  }
}

function buildConfetti() {
  clearChildren(els.confettiLayer);
  const palette = ['#d22030', '#ffb3b8', '#ffd6d9', '#ffffff', '#f7d48a'];
  Array.from({ length: 44 }).forEach((_, index) => {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.width = `${8 + Math.random() * 10}px`;
    piece.style.height = `${10 + Math.random() * 18}px`;
    piece.style.background = palette[index % palette.length];
    piece.style.animationDelay = `${Math.random() * 0.8}s`;
    piece.style.animationDuration = `${3.5 + Math.random() * 2}s`;
    piece.style.transform = `translateY(-120%) rotate(${Math.random() * 360}deg)`;
    els.confettiLayer.appendChild(piece);
  });
}

function showPopup() {
  if (!state.sessionActive || state.sessionPopupShown) return;
  state.sessionPopupShown = true;
  buildConfetti();
  els.popup.classList.remove('is-hidden');
  state.popupAutoCloseTimer = window.setTimeout(closePopup, TIMING_CONFIG.popupAutoCloseMs);
}

function closePopup() {
  els.popup.classList.add('is-hidden');
  clearPopupTimers();
}

function openExternalUrl(url) {
  if (window.kioskShell?.openExternal) {
    window.kioskShell.openExternal(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

function bindEvents() {
  els.startButton.addEventListener('click', setMapView);
  els.footerSecondaryButton.addEventListener('click', showHomeView);
  els.panelHomeButton.addEventListener('click', showHomeView);
  els.returnHomeButton.addEventListener('click', showHomeView);
  els.restartSessionButton.addEventListener('click', restartSession);

  els.menuItems.forEach((item) => {
    item.addEventListener('click', () => openView(item.dataset.view));
  });

  els.closePopupButton.addEventListener('click', closePopup);
  els.popup.addEventListener('click', (event) => {
    if (event.target === els.popup) closePopup();
  });
  els.instagramLink.addEventListener('click', () => {
    closePopup();
    openExternalUrl(POPUP_CONFIG.linkUrl);
  });

  ['pointerdown', 'pointermove', 'touchstart', 'mousemove', 'keydown'].forEach((eventName) => {
    window.addEventListener(eventName, () => {
      if (state.sessionActive && state.currentView !== 'home') resetInactivityTimer();
    }, { passive: true });
  });
}

async function loadLogos() {
  try {
    const [attendeeLogos, partnerLogos] = await Promise.all([
      fetchLogosFromGitHub(LOGO_CONFIG.attendeeDir),
      fetchLogosFromGitHub(LOGO_CONFIG.partnerDir),
    ]);
    state.attendeeLogos = attendeeLogos;
    state.partnerLogos = partnerLogos;
  } catch (error) {
    console.error('Unable to load logos', error);
    state.attendeeLogos = [];
    state.partnerLogos = [];
  }

  renderPartnerShowcase();
  renderAttendeeMarquee();
}

function init() {
  applyCopy();
  bindEvents();
  loadLogos();
  els.mappedinFrame.setAttribute('src', getMapUrl());
  showHomeView();
}

init();
