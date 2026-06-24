// ─────────────────────────────────────────────────────────────────────────────
// Idle ad player — full-screen portrait ads after kiosk inactivity
// ─────────────────────────────────────────────────────────────────────────────

import { loadActiveAds, resolveAdAssetUrl } from './shared/ads-loader.js';
import { TIMING_CONFIG } from './config/timing.js';

const CAPTURE_EVENTS = ['touchstart', 'pointerdown', 'click', 'keydown', 'scroll', 'mousemove'];
const RESET_EVENTS = ['touchstart', 'pointerdown', 'pointermove', 'click', 'keydown', 'scroll', 'mousemove'];
const TEST_ACK_KEY = 'kiosk-idle-ad-test-ack';

export function initIdleAdPlayer({ overlay, mediaEl, onWake } = {}) {
  if (!overlay || !mediaEl) {
    return {
      refreshAds: async () => {},
      exitIdleAdMode: () => {},
      resetIdleAdTimer: () => {},
      forceIdleAdMode: async () => {},
    };
  }

  const state = {
    idleTimer: null,
    imageTimer: null,
    pollTimer: null,
    ads: [],
    meta: {},
    isPlaying: false,
    lastAdId: null,
    videoEl: null,
    captureBound: false,
  };

  function clearIdleTimer() {
    if (state.idleTimer) {
      clearTimeout(state.idleTimer);
      state.idleTimer = null;
    }
  }

  function getTestAck() {
    try {
      return localStorage.getItem(TEST_ACK_KEY) || '';
    } catch {
      return '';
    }
  }

  function acknowledgeTestSignal() {
    const at = state.meta?.testIdleAdsAt;
    if (!at) return;
    try {
      localStorage.setItem(TEST_ACK_KEY, at);
    } catch { /* ignore */ }
  }

  function shouldTriggerTestAds() {
    const at = state.meta?.testIdleAdsAt;
    if (!at || !state.ads.length) return false;
    return String(at) > getTestAck();
  }

  function tryRemoteTestTrigger() {
    if (state.isPlaying || !shouldTriggerTestAds()) return false;
    acknowledgeTestSignal();
    enterIdleAdMode();
    return true;
  }

  async function checkRemoteTestTrigger() {
    if (state.isPlaying) return;
    await refreshAds();
    tryRemoteTestTrigger();
  }

  async function forceIdleAdMode() {
    await refreshAds();
    if (!state.ads.length) return false;
    enterIdleAdMode();
    return true;
  }

  function clearImageTimer() {
    if (state.imageTimer) {
      clearTimeout(state.imageTimer);
      state.imageTimer = null;
    }
  }

  function pauseVideo() {
    if (state.videoEl) {
      try {
        state.videoEl.pause();
        state.videoEl.currentTime = 0;
      } catch { /* ignore */ }
    }
  }

  function clearMedia() {
    pauseVideo();
    mediaEl.innerHTML = '';
    state.videoEl = null;
  }

  function bindCapture() {
    if (state.captureBound) return;
    state.captureBound = true;
    CAPTURE_EVENTS.forEach((ev) => {
      window.addEventListener(ev, onCaptureActivity, { passive: true, capture: true });
    });
  }

  function unbindCapture() {
    if (!state.captureBound) return;
    state.captureBound = false;
    CAPTURE_EVENTS.forEach((ev) => {
      window.removeEventListener(ev, onCaptureActivity, { capture: true });
    });
  }

  function onCaptureActivity() {
    if (state.isPlaying) exitIdleAdMode();
  }

  function pickNextAd() {
    const pool = state.ads;
    if (!pool.length) return null;
    if (pool.length === 1) return pool[0];

    let pick = pool[0];
    for (let i = 0; i < 12; i++) {
      const candidate = pool[Math.floor(Math.random() * pool.length)];
      if (candidate.id !== state.lastAdId) {
        pick = candidate;
        break;
      }
      pick = candidate;
    }
    return pick;
  }

  function playNextAd() {
    if (!state.isPlaying) return;

    const ad = pickNextAd();
    if (!ad) {
      exitIdleAdMode();
      return;
    }

    state.lastAdId = ad.id;
    clearImageTimer();
    clearMedia();

    if (ad.type === 'video') {
      const video = document.createElement('video');
      video.className = 'idle-ad-overlay__video';
      video.src = resolveAdAssetUrl(ad.src);
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.controls = false;
      video.setAttribute('playsinline', '');
      video.setAttribute('disablepictureinpicture', '');
      video.addEventListener('ended', () => {
        if (!state.isPlaying) return;
        if (state.ads.length > 1) playNextAd();
        else {
          video.currentTime = 0;
          video.play().catch(() => exitIdleAdMode());
        }
      });
      video.addEventListener('error', () => {
        if (state.isPlaying) playNextAd();
      });
      mediaEl.appendChild(video);
      state.videoEl = video;
      video.play().catch(() => playNextAd());
      return;
    }

    const img = document.createElement('img');
    img.className = 'idle-ad-overlay__image';
    img.src = resolveAdAssetUrl(ad.src);
    img.alt = ad.title || '';
    img.decoding = 'async';
    img.addEventListener('error', () => {
      if (state.isPlaying) playNextAd();
    });
    mediaEl.appendChild(img);

    const ms = state.meta.imageSlideDurationMs
      || TIMING_CONFIG.idleAdImageSlideMs
      || 10_000;
    state.imageTimer = setTimeout(() => {
      if (state.isPlaying) playNextAd();
    }, ms);
  }

  function enterIdleAdMode() {
    if (state.isPlaying || !state.ads.length) return;
    state.isPlaying = true;
    overlay.classList.remove('is-hidden');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-idle-ad-active');
    bindCapture();
    playNextAd();
  }

  function exitIdleAdMode() {
    if (!state.isPlaying) return;
    state.isPlaying = false;
    clearIdleTimer();
    clearImageTimer();
    pauseVideo();
    clearMedia();
    unbindCapture();
    overlay.classList.add('is-hidden');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-idle-ad-active');
    resetIdleAdTimer();
    if (typeof onWake === 'function') onWake();
  }

  async function refreshAds() {
    try {
      const data = await loadActiveAds({ force: true });
      state.ads = data.ads || [];
      state.meta = data.meta || {};
    } catch {
      state.ads = [];
      state.meta = {};
    }
    if (!state.ads.length && state.isPlaying) exitIdleAdMode();
  }

  function resetIdleAdTimer() {
    if (state.isPlaying) return;
    clearIdleTimer();
    if (!state.ads.length) return;

    const delay = state.meta.idleDelayMs || TIMING_CONFIG.idleAdDelayMs || 180_000;
    state.idleTimer = setTimeout(async () => {
      await refreshAds();
      if (state.ads.length) enterIdleAdMode();
      else resetIdleAdTimer();
    }, delay);
  }

  function onUserActivity() {
    if (state.isPlaying) exitIdleAdMode();
    else resetIdleAdTimer();
  }

  RESET_EVENTS.forEach((ev) => {
    window.addEventListener(ev, onUserActivity, { passive: true });
  });

  const pollMs = TIMING_CONFIG.idleAdTestPollMs || 15_000;
  state.pollTimer = window.setInterval(() => {
    if (!state.isPlaying) checkRemoteTestTrigger();
  }, pollMs);

  refreshAds().then(() => {
    if (!tryRemoteTestTrigger()) resetIdleAdTimer();
  });

  return {
    refreshAds,
    exitIdleAdMode,
    resetIdleAdTimer,
    forceIdleAdMode,
    checkRemoteTestTrigger,
  };
}
