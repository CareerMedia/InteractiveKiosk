export const KIOSK_CONFIG = {
  eventTitle: 'Interactive Kiosk',
  eventSubtitle:
    'Explore the fair, discover attending employers, and navigate the event map in one touch.',
  startButtonLabel: 'Start Here',
  startButtonSubcopy: 'Tap to open the interactive event map',
  inactivityTimeoutMs: 75_000,
  popupDelayMs: 12_000,
  popupAutoCloseMs: 18_000,
  logoPageDurationMs: 5_500,
  attendeeLogosPerPagePortrait: 12,
  attendeeLogosPerPageLandscape: 16,
  kioskReturnMessage: 'The kiosk will return home automatically after inactivity.',
  instagramHandle: '@csuncareercenter',
  instagramUrl: 'https://www.instagram.com/csuncareercenter/',
  instagramHeadline: 'Follow us for career wins, event drops, and student success stories',
  instagramPopupTitle: 'Level up your career feed',
  instagramPopupBody:
    'Scan the QR code and join the CSUN Career Center Instagram while you explore the fair.',
} as const;
