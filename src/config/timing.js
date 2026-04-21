export const TIMING_CONFIG = {
  inactivityTimeoutMs: 90000,
  popupDelayMs: 10000,
  popupAutoCloseMs: 18000,
  attendeePageRotateMs: 5200,
  transitionPauseMs: 250,
  // Kept short so admin edits propagate quickly. The kiosk also uses the
  // `version` counter in config.json as part of the cache key, which
  // invalidates these entries any time the admin commits a change.
  logoCacheTtlMs: 1000 * 60 * 5,
};
