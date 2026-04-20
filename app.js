import { KIOSK_CONFIG, LOGO_CONFIG, MAP_CONFIG } from './config.js';

const state = {
  mode: 'home',
  inactivityTimer: null,
  countdownTimer: null,
  popupTimer: null,
  popupAutoCloseTimer: null,
  sessionPopupShown: false,
  attendeePageTimer: null,
  attendeePageIndex: 0,
  attendeePages: [],
  attendees: [],
  partners: [],
};

const els = {
  eventTitle: document.getElementById('event-title'),
  eventSubtitle: document.getElementById('event-subtitle'),
  attendeeCount: document.getElementById('attendee-count'),
  partnerCount: document.getElementById('partner-count'),
  startButtonSubcopy: document.getElementById('start-button-subcopy'),
  startButton: document.getElementById('start-button'),
  homeScreen: document.getElementById('home-screen'),
  mapScreen: document.getElementById('map-screen'),
  returnMessage: document.getElementById('return-message'),
  countdownPill: document.getElementById('countdown-pill'),
  returnHomeButton: document.getElementById('return-home-button'),
  mapFrame: document.getElementById('mappedin-frame'),
  logoStage: document.getElementById('logo-stage'),
  partnerTrack: document.getElementById('partner-track'),
  popup: document.getElementById('instagram-popup'),
  closePopupButton: document.getElementById('close-popup-button'),
  instagramTitle: document.getElementById('instagram-title'),
  instagramHeadline: document.getElementById('instagram-headline'),
  instagramHandle: document.getElementById('instagram-handle'),
  instagramBody: document.getElementById('instagram-body'),
  instagramLink: document.getElementById('instagram-link'),
  confettiLayer: document.getElementById('confetti-layer'),
  mapShell: document.getElementById('map-shell'),
};

function applyCopy() {
  els.eventTitle.textContent = KIOSK_CONFIG.eventTitle;
  els.eventSubtitle.textContent = KIOSK_CONFIG.eventSubtitle;
  els.startButton.textContent = KIOSK_CONFIG.startButtonLabel;
  els.startButtonSubcopy.textContent = KIOSK_CONFIG.startButtonSubcopy;
  els.returnMessage.textContent = KIOSK_CONFIG.kioskReturnMessage;
  els.instagramTitle.textContent = KIOSK_CONFIG.instagramPopupTitle;
  els.instagramHeadline.textContent = KIOSK_CONFIG.instagramHeadline;
  els.instagramHandle.textContent = KIOSK_CONFIG.instagramHandle;
  els.instagramBody.textContent = KIOSK_CONFIG.instagramPopupBody;
  els.instagramLink.href = KIOSK_CONFIG.instagramUrl;
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

function formatName(name) {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function chunk(items, size) {
  const output = [];
  for (let i = 0; i < items.length; i += size) {
    output.push(items.slice(i, i + size));
  }
  return output;
}

async function fetchLogosFromGitHub(categoryDir) {
  const { owner, repo, branch } = getRepoContext();
  if (!owner || !repo) {
    throw new Error('Could not auto-detect GitHub repo context.');
  }

  const endpoint = `https://api.github.com/repos/${owner}/${repo}/contents/${categoryDir}?ref=${branch}`;
  const response = await fetch(endpoint, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status} for ${categoryDir}`);
  }

  const entries = await response.json();
  return entries
    .filter((entry) => entry.type === 'file')
    .filter((entry) => {
      const extension = entry.name.split('.').pop().toLowerCase();
      return LOGO_CONFIG.supportedExtensions.includes(extension);
    })
    .map((entry) => ({
      id: entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: formatName(entry.name),
      src: entry.download_url,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function renderPartnerRail(logos) {
  els.partnerTrack.innerHTML = '';

  if (!logos.length) {
    els.partnerTrack.classList.remove('is-animated');
    els.partnerTrack.innerHTML =
      '<div class="partner-empty">Add partner logos to <code>assets/employers/partners</code> in the repo.</div>';
    return;
  }

  const useAnimation = logos.length > 4;
  const list = useAnimation ? [...logos, ...logos] : logos;
  els.partnerTrack.classList.toggle('is-animated', useAnimation);

  list.forEach((logo) => {
    const chip = document.createElement('div');
    chip.className = 'partner-chip';

    const img = document.createElement('img');
    img.src = logo.src;
    img.alt = logo.name;
    img.loading = 'lazy';

    chip.appendChild(img);
    els.partnerTrack.appendChild(chip);
  });
}

function stopAttendeeRotation() {
  if (state.attendeePageTimer) {
    clearInterval(state.attendeePageTimer);
    state.attendeePageTimer = null;
  }
}

function activateAttendeePage(index) {
  const pages = Array.from(els.logoStage.querySelectorAll('.logo-page'));
  pages.forEach((page, pageIndex) => {
    page.classList.toggle('is-active', pageIndex === index);
  });
}

function renderAttendeePages(logos) {
  stopAttendeeRotation();
  els.logoStage.innerHTML = '';

  if (!logos.length) {
    els.logoStage.innerHTML =
      '<div class="logo-empty">Add attendee logos to <code>assets/employers/attendees</code> in the repo.</div>';
    return;
  }

  const perPage = window.matchMedia('(orientation: portrait)').matches ? 6 : 12;
  const pages = chunk(logos, perPage);
  state.attendeePages = pages;
  state.attendeePageIndex = 0;

  pages.forEach((pageLogos, pageIndex) => {
    const page = document.createElement('div');
    page.className = `logo-page${pageIndex === 0 ? ' is-active' : ''}`;

    pageLogos.forEach((logo) => {
      const card = document.createElement('div');
      card.className = 'logo-card';

      const img = document.createElement('img');
      img.src = logo.src;
      img.alt = logo.name;
      img.loading = 'lazy';

      card.appendChild(img);
      page.appendChild(card);
    });

    els.logoStage.appendChild(page);
  });

  if (pages.length > 1) {
    state.attendeePageTimer = window.setInterval(() => {
      state.attendeePageIndex = (state.attendeePageIndex + 1) % pages.length;
      activateAttendeePage(state.attendeePageIndex);
    }, KIOSK_CONFIG.attendeePageRotateMs);
  }
}

function updateCounts() {
  els.attendeeCount.textContent = String(state.attendees.length);
  els.partnerCount.textContent = String(state.partners.length);
}

function buildConfetti() {
  els.confettiLayer.innerHTML = '';
  const colors = ['#d22030', '#f04b58', '#ffffff', '#f6b7bc', '#ff8a66'];
  Array.from({ length: 54 }).forEach((_, index) => {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.animationDelay = `${Math.random() * 1.2}s`;
    piece.style.animationDuration = `${3.6 + Math.random() * 3.8}s`;
    piece.style.background = colors[index % colors.length];
    piece.style.setProperty('--drift', `${-80 + Math.random() * 160}px`);
    piece.style.transform = `rotate(${Math.random() * 360}deg) scale(${0.65 + Math.random() * 0.85})`;
    els.confettiLayer.appendChild(piece);
  });
}

function showPopup() {
  if (state.sessionPopupShown || state.mode !== 'map') {
    return;
  }
  state.sessionPopupShown = true;
  buildConfetti();
  els.popup.classList.remove('is-hidden');
  clearTimeout(state.popupAutoCloseTimer);
  state.popupAutoCloseTimer = window.setTimeout(hidePopup, KIOSK_CONFIG.popupAutoCloseMs);
}

function hidePopup() {
  els.popup.classList.add('is-hidden');
  clearTimeout(state.popupAutoCloseTimer);
  state.popupAutoCloseTimer = null;
  resetInactivityTimer();
}

function setMode(nextMode) {
  state.mode = nextMode;
  els.homeScreen.classList.toggle('is-hidden', nextMode !== 'home');
  els.mapScreen.classList.toggle('is-hidden', nextMode !== 'map');
}

function clearSessionTimers() {
  clearTimeout(state.popupTimer);
  clearTimeout(state.popupAutoCloseTimer);
  state.popupTimer = null;
  state.popupAutoCloseTimer = null;
}

function goHome() {
  clearSessionTimers();
  clearInterval(state.countdownTimer);
  state.countdownTimer = null;
  clearTimeout(state.inactivityTimer);
  state.inactivityTimer = null;
  hidePopup();
  state.sessionPopupShown = false;
  setMode('home');
}

function updateCountdownText(seconds) {
  els.countdownPill.textContent = `Home in ${seconds}s`;
}

function resetInactivityTimer() {
  if (state.mode !== 'map') {
    return;
  }

  clearTimeout(state.inactivityTimer);
  clearInterval(state.countdownTimer);

  const startedAt = Date.now();
  updateCountdownText(Math.ceil(KIOSK_CONFIG.inactivityTimeoutMs / 1000));

  state.countdownTimer = window.setInterval(() => {
    const elapsed = Date.now() - startedAt;
    const remainingMs = Math.max(KIOSK_CONFIG.inactivityTimeoutMs - elapsed, 0);
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    updateCountdownText(remainingSeconds);
  }, 250);

  state.inactivityTimer = window.setTimeout(() => {
    goHome();
  }, KIOSK_CONFIG.inactivityTimeoutMs);
}

function startSession() {
  clearSessionTimers();
  state.sessionPopupShown = false;
  setMode('map');
  els.mapFrame.src = getMapUrl();
  resetInactivityTimer();
  state.popupTimer = window.setTimeout(showPopup, KIOSK_CONFIG.popupDelayMs);
}

function handleActivity() {
  if (state.mode === 'map') {
    resetInactivityTimer();
  }
}

function attachEvents() {
  els.startButton.addEventListener('click', startSession);
  els.returnHomeButton.addEventListener('click', goHome);
  els.closePopupButton.addEventListener('click', hidePopup);
  els.popup.addEventListener('click', (event) => {
    if (event.target === els.popup) {
      hidePopup();
    }
  });

  ['pointerdown', 'pointermove', 'touchstart', 'keydown', 'wheel'].forEach((eventName) => {
    window.addEventListener(eventName, handleActivity, { passive: true });
  });

  els.mapShell.addEventListener('pointerdown', handleActivity, { passive: true });
  els.mapShell.addEventListener('touchstart', handleActivity, { passive: true });
  els.mapFrame.addEventListener('load', handleActivity);

  window.addEventListener('message', (event) => {
    if (event.origin !== MAP_CONFIG.origin) {
      return;
    }
    handleActivity();
  });

  window.addEventListener('resize', () => {
    renderAttendeePages(state.attendees);
    renderPartnerRail(state.partners);
  });
}

async function bootstrapLogos() {
  try {
    const [attendees, partners] = await Promise.all([
      fetchLogosFromGitHub(LOGO_CONFIG.attendeeDir),
      fetchLogosFromGitHub(LOGO_CONFIG.partnerDir),
    ]);

    state.attendees = attendees;
    state.partners = partners;
    updateCounts();
    renderAttendeePages(attendees);
    renderPartnerRail(partners);
  } catch (error) {
    console.error(error);
    state.attendees = [];
    state.partners = [];
    updateCounts();
    renderAttendeePages([]);
    renderPartnerRail([]);
  }
}

async function init() {
  applyCopy();
  attachEvents();
  await bootstrapLogos();
}

init();
