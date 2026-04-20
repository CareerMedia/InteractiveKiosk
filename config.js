/*
  Edit this file whenever you want to change kiosk text, timing, or the map link.

  Original embed reference supplied for the project:
  <iframe href="https://www.mappedin.com/" title="Mappedin Map" name="Mappedin Map"
  allow="clipboard-write 'self' https://app.mappedin.com; web-share 'self' https://app.mappedin.com"
  scrolling="no" width="100%" height="650" frameborder="0" style="border:0"
  src="https://app.mappedin.com/map/67be0704561935000b3e6cbb?embedded=true"></iframe>
*/

export const KIOSK_CONFIG = {
  eventTitle: 'Career Fair Interactive Kiosk',
  eventSubtitle:
    'Discover employers at the fair, explore featured partners, and launch the live event map.',
  startButtonLabel: 'Start Here',
  startButtonSubcopy: 'Tap below to browse the event floor map and locate employers in real time.',
  inactivityTimeoutMs: 90000,
  popupDelayMs: 10000,
  popupAutoCloseMs: 18000,
  attendeePageRotateMs: 4800,
  kioskReturnMessage: 'This kiosk returns home after a short period of inactivity.',
  instagramPopupTitle: 'Follow the Career Center and stay in the loop',
  instagramHeadline:
    'Scan the QR code for event highlights, career tips, employer spotlights, and upcoming workshops.',
  instagramHandle: '@csuncareercenter',
  instagramUrl: 'https://www.instagram.com/csuncareercenter/',
  instagramPopupBody:
    'Join the community for quick career advice, behind-the-scenes coverage, and the latest Career Center updates.',
};

export const MAP_CONFIG = {
  title: 'Mappedin Map',
  iframeName: 'Mappedin Map',
  allowPermissions:
    "clipboard-write 'self' https://app.mappedin.com; web-share 'self' https://app.mappedin.com",
  origin: 'https://app.mappedin.com',
  embedUrl: 'https://app.mappedin.com/map/67be0704561935000b3e6cbb?embedded=true',
};

export const LOGO_CONFIG = {
  attendeeDir: 'assets/employers/attendees',
  partnerDir: 'assets/employers/partners',
  supportedExtensions: ['png', 'jpg', 'jpeg', 'svg', 'webp', 'avif'],
  githubBranch: 'main',
  /*
    Optional overrides. Leave these blank to auto-detect from your GitHub Pages URL.
    Example:
    githubOwner: 'careermedia',
    githubRepo: 'InteractiveKiosk',
  */
  githubOwner: '',
  githubRepo: '',
};
