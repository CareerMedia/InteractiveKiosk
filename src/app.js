import { EVENT_CONFIG } from './config/event.js';
import { LOGO_CONFIG } from './config/logos.js';
import { MAP_CONFIG } from './config/map.js';
import { POPUP_CONFIG } from './config/popup.js';
import { TIMING_CONFIG } from './config/timing.js';

const state = {
  mode: 'home',
  inactivityTimer: null,
  countdownTimer: null,
  attendeeRotateTimer: null,
  popupTimer: null,
  popupAutoCloseTimer: null,
  sessionPopupShown: false,
  attendeeLogos: [],
  partnerLogos: [],
  attendeePages: [],
  attendeePageIndex: 0,
};

const els = {
  app: document.getElementById('app'),
  homeScreen: document.getElementById('home-screen'),
  mapScreen: document.getElementById('map-screen'),
  eventLabelPill: document.getElementById('event-label-pill'),
  eventDate: document.getElementById('event-date'),
  ctaText: document.getElementById('cta-text'),
  attendeeCount: document.getElementById('attendee-count'),
  logoStage: document.getElementById('logo-stage'),
  pageDots: document.getElementById('page-dots'),
  partnerTrack: document.getElementById('partner-logos-row'),
  mapPartnerTrack: document.getElementById('map-partner-track'),
  mapPartnerRibbon: document.getElementById('map-partner-ribbon'),
  startButton: document.getElementById('start-button'),
  returnHomeButton: document.getElementById('return-home-button'),
  restartSessionButton: document.getElementById('restart-session-button'),
  countdownPill: document.getElementById('countdown-pill'),
  returnMessage: document.getElementById('return-message'),
  mapToolbarTitle: document.getElementById('map-toolbar-title'),
  mappedinFrame: document.getElementById('mappedin-frame'),
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

function applyCopy() {
  els.eventLabelPill.textContent = EVENT_CONFIG.label;
  els.eventDate.textContent = EVENT_CONFIG.date;
  els.ctaText.textContent = EVENT_CONFIG.ctaText;
  els.returnMessage.textContent = EVENT_CONFIG.returnMessage;
  els.mapToolbarTitle.textContent = EVENT_CONFIG.mapToolbarTitle;

  els.instagramKicker.textContent = POPUP_CONFIG.kicker;
  els.instagramTitle.textContent = POPUP_CONFIG.title;
  els.instagramHeadline.textContent = POPUP_CONFIG.headline;
  els.instagramHandle.textContent = POPUP_CONFIG.handle;
  els.instagramBody.textContent = POPUP_CONFIG.body;
  els.instagramLink.href = POPUP_CONFIG.linkUrl;
  els.instagramLink.textContent = POPUP_CONFIG.linkLabel;
}

function formatName(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getMapUrl() {
  const url = new URL(MAP_CONFIG.embedUrl);
  if (!url.searchParams.has('embedded')) {
    url.searchParams.set('embedded', 'true');
  }
  if (!url.searchParams.has('kiosk')) {
    url.searchParams.set('kiosk', 'true');
  }
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

function getCacheKey(categoryDir) {
  const { owner, repo, branch } = getRepoContext();
  return `kiosk-logo-cache:${owner}:${repo}:${branch}:${categoryDir}`;
}

function readCache(categoryDir) {
  try {
    const raw = localStorage.getItem(getCacheKey(categoryDir));
    if (!raw) {
      return null;
    }
    const payload = JSON.parse(raw);
    if (!payload.expiresAt || Date.now() > payload.expiresAt || !Array.isArray(payload.items)) {
      return null;
    }
    return payload.items;
  } catch {
    return null;
  }
}

function writeCache(categoryDir, items) {
  try {
    localStorage.setItem(
      getCacheKey(categoryDir),
      JSON.stringify({
        expiresAt: Date.now() + TIMING_CONFIG.logoCacheTtlMs,
        items,
      }),
    );
  } catch {
    // ignore storage issues
  }
}

async function fetchLogosFromGitHub(categoryDir) {
  const cached = readCache(categoryDir);
  if (cached) {
    return cached;
  }

  const { owner, repo, branch } = getRepoContext();
  if (!owner || !repo) {
    return [];
  }

  const endpoint = `https://api.github.com/repos/${owner}/${repo}/contents/${categoryDir}?ref=${branch}`;
  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/vnd.github+json',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status} for ${categoryDir}`);
  }

  const entries = await response.json();
  const items = entries
    .filter((entry) => entry.type === 'file')
    .filter((entry) => {
      const extension = entry.name.split('.').pop()?.toLowerCase() || '';
      return LOGO_CONFIG.supportedExtensions.includes(extension);
    })
    .map((entry) => ({
      id: entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: formatName(entry.name),
      src: entry.download_url,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  writeCache(categoryDir, items);
  return items;
}

function clearChildren(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function chunk(items, size) {
  const output = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

function createLogoCard(logo, extraClass = '') {
  const card = document.createElement('article');
  card.className = `logo-card${extraClass ? ` ${extraClass}` : ''}`;

  const image = document.createElement('img');
  image.src = logo.src;
  image.alt = logo.name;
  image.loading = 'lazy';

  card.appendChild(image);
  return card;
}

function renderPartnerTrack() {
  clearChildren(els.partnerTrack);
  clearChildren(els.mapPartnerTrack);

  if (!state.partnerLogos.length) {
    const empty = document.createElement('div');
    empty.className = 'partner-empty-hint';
    empty.innerHTML = 'Add partner logos to <code>assets/employers/partners/</code>';
    els.partnerTrack.appendChild(empty);
    els.mapPartnerRibbon.classList.add('is-empty');
    return;
  }

  els.mapPartnerRibbon.classList.remove('is-empty');

  // Render partner logo cards (new horizontal row style)
  state.partnerLogos.forEach((logo) => {
    const card = document.createElement('div');
    card.className = 'partner-logo-card';
    const image = document.createElement('img');
    image.src = logo.src;
    image.alt = logo.name;
    image.loading = 'lazy';
    card.appendChild(image);
    els.partnerTrack.appendChild(card);
  });

  // Map ribbon chips
  state.partnerLogos.forEach((logo) => {
    const chip = document.createElement('div');
    chip.className = 'map-partner-chip';
    const image = document.createElement('img');
    image.src = logo.src;
    image.alt = logo.name;
    image.loading = 'lazy';
    chip.appendChild(image);
    els.mapPartnerTrack.appendChild(chip);
  });
}

function updatePageDots() {
  clearChildren(els.pageDots);
  state.attendeePages.forEach((_, index) => {
    const dot = document.createElement('span');
    dot.className = `page-dot${index === state.attendeePageIndex ? ' is-active' : ''}`;
    els.pageDots.appendChild(dot);
  });
}

function activateAttendeePage(index) {
  const pages = Array.from(els.logoStage.querySelectorAll('.logo-page'));
  pages.forEach((page, pageIndex) => {
    page.classList.toggle('is-active', pageIndex === index);
  });

  Array.from(els.pageDots.children).forEach((dot, dotIndex) => {
    dot.classList.toggle('is-active', dotIndex === index);
  });
}

function stopAttendeeRotation() {
  if (state.attendeeRotateTimer) {
    window.clearInterval(state.attendeeRotateTimer);
    state.attendeeRotateTimer = null;
  }
}

function getPerPage() {
  const portrait = window.matchMedia('(orientation: portrait)').matches;
  if (portrait) {
    return window.innerHeight > 1100 ? 12 : 9;
  }
  return window.innerWidth > 1500 ? 12 : 10;
}

function renderAttendeePages() {
  stopAttendeeRotation();
  clearChildren(els.logoStage);

  if (!state.attendeeLogos.length) {
    const empty = document.createElement('div');
    empty.className = 'logo-empty';
    empty.innerHTML = 'Add attendee logos to <code>assets/employers/attendees</code>.';
    els.logoStage.appendChild(empty);
    clearChildren(els.pageDots);
    return;
  }

  state.attendeePages = chunk(state.attendeeLogos, getPerPage());
  state.attendeePageIndex = 0;

  state.attendeePages.forEach((pageLogos, pageIndex) => {
    const page = document.createElement('div');
    page.className = `logo-page${pageIndex === 0 ? ' is-active' : ''}`;

    pageLogos.forEach((logo) => {
      page.appendChild(createLogoCard(logo));
    });

    els.logoStage.appendChild(page);
  });

  updatePageDots();

  if (state.attendeePages.length > 1) {
    state.attendeeRotateTimer = window.setInterval(() => {
      state.attendeePageIndex = (state.attendeePageIndex + 1) % state.attendeePages.length;
      activateAttendeePage(state.attendeePageIndex);
    }, TIMING_CONFIG.attendeePageRotateMs);
  }
}

function updateCounts() {
  if (els.attendeeCount) els.attendeeCount.textContent = state.attendeeLogos.length > 0 ? `(${state.attendeeLogos.length})` : '';
}

function buildConfetti() {
  clearChildren(els.confettiLayer);
  const palette = ['#d22030', '#ff6f61', '#ffd7db', '#ffffff', '#f5a623'];

  Array.from({ length: 44 }).forEach((_, index) => {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.width = `${8 + Math.random() * 10}px`;
    piece.style.height = `${10 + Math.random() * 18}px`;
    piece.style.background = palette[index % palette.length];
    piece.style.animationDelay = `${Math.random() * 0.8}s`;
    piece.style.animationDuration = `${3.8 + Math.random() * 2.2}s`;
    piece.style.transform = `translateY(-120%) rotate(${Math.random() * 360}deg)`;
    els.confettiLayer.appendChild(piece);
  });
}

function clearPopupTimers() {
  if (state.popupTimer) {
    window.clearTimeout(state.popupTimer);
    state.popupTimer = null;
  }
  if (state.popupAutoCloseTimer) {
    window.clearTimeout(state.popupAutoCloseTimer);
    state.popupAutoCloseTimer = null;
  }
}

function showPopup() {
  if (state.sessionPopupShown || state.mode !== 'map') {
    return;
  }

  state.sessionPopupShown = true;
  buildConfetti();
  els.popup.classList.remove('is-hidden');
  els.app.classList.add('is-modal-open');

  state.popupAutoCloseTimer = window.setTimeout(() => {
    closePopup();
  }, TIMING_CONFIG.popupAutoCloseMs);
}

function closePopup() {
  els.popup.classList.add('is-hidden');
  els.app.classList.remove('is-modal-open');
  clearPopupTimers();
}

function schedulePopup() {
  clearPopupTimers();
  if (state.sessionPopupShown || state.mode !== 'map') {
    return;
  }

  state.popupTimer = window.setTimeout(() => {
    showPopup();
  }, TIMING_CONFIG.popupDelayMs);
}

function clearInactivityTimers() {
  if (state.inactivityTimer) {
    window.clearTimeout(state.inactivityTimer);
    state.inactivityTimer = null;
  }
  if (state.countdownTimer) {
    window.clearInterval(state.countdownTimer);
    state.countdownTimer = null;
  }
}

function updateCountdownDisplay(expiresAt) {
  const secondsLeft = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  els.countdownPill.textContent = `Home in ${secondsLeft}s`;
}

function resetInactivityTimer() {
  if (state.mode !== 'map') {
    return;
  }

  clearInactivityTimers();
  const expiresAt = Date.now() + TIMING_CONFIG.inactivityTimeoutMs;
  updateCountdownDisplay(expiresAt);

  state.countdownTimer = window.setInterval(() => {
    updateCountdownDisplay(expiresAt);
  }, 1000);

  state.inactivityTimer = window.setTimeout(() => {
    goHome({ resetMap: true });
  }, TIMING_CONFIG.inactivityTimeoutMs);
}

function resetMapFrame() {
  els.mappedinFrame.src = getMapUrl();
}

function openMap() {
  state.mode = 'map';
  els.homeScreen.classList.add('is-hidden');
  els.mapScreen.classList.remove('is-hidden');
  els.app.dataset.mode = 'map';
  if (!els.mappedinFrame.src) {
    resetMapFrame();
  }

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
  clearInactivityTimers();
  if (resetMap) {
    resetMapFrame();
  }
}

function restartSession() {
  state.sessionPopupShown = false;
  closePopup();
  clearPopupTimers();
  resetMapFrame();
  window.setTimeout(() => {
    resetInactivityTimer();
    schedulePopup();
  }, 500);
}

function bindEvents() {
  els.startButton.addEventListener('click', openMap);
  els.returnHomeButton.addEventListener('click', () => goHome({ resetMap: true }));
  els.restartSessionButton.addEventListener('click', restartSession);
  els.closePopupButton.addEventListener('click', closePopup);
  els.popup.addEventListener('click', (event) => {
    if (event.target === els.popup) {
      closePopup();
    }
  });

  ['pointerdown', 'pointermove', 'touchstart', 'mousemove', 'keydown'].forEach((eventName) => {
    window.addEventListener(
      eventName,
      () => {
        if (state.mode === 'map') {
          resetInactivityTimer();
        }
      },
      { passive: true },
    );
  });

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer) {
      window.clearTimeout(resizeTimer);
    }
    resizeTimer = window.setTimeout(() => {
      renderAttendeePages();
    }, 180);
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
    console.error('Unable to load logos from GitHub.', error);
    state.attendeeLogos = [];
    state.partnerLogos = [];
  }

  updateCounts();
  renderAttendeePages();
  renderPartnerTrack();
}

function init() {
  applyCopy();
  resetMapFrame();
  bindEvents();
  loadLogos();
  goHome({ resetMap: false });
}

init();
