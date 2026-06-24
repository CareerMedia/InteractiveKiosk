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
  idleAdDelayMs: 180_000,
  idleAdImageSlideMs: 10_000,
  idleAdTestPollMs: 15_000,
  /** IANA timezone for kiosk clock display (CSUN / Los Angeles). The displayed
   *  time is always derived from this zone, regardless of the device's own
   *  timezone setting, so the device clock just needs to be roughly correct. */
  kioskTimezone: 'America/Los_Angeles',
  /** Re-sync network time periodically (kiosk hardware clocks can drift). */
  clockSyncIntervalMs: 60 * 60 * 1000,
  /** Optional network time endpoint for drift correction. Left empty by default
   *  because the device clock is the source of truth and public time APIs have
   *  proven unreliable (returning stale dates that corrupted the display). Set
   *  to an endpoint returning `{ datetime: "<ISO8601>" }` to re-enable. */
  timeApiUrl: '',
  /** Network time is only trusted to correct drift within this window; any
   *  larger disagreement is ignored so a bad API response can't break the clock. */
  maxClockDriftMs: 5 * 60 * 1000,
};
