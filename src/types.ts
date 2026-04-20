export type KioskMode = 'home' | 'map';

export interface LogoItem {
  id: string;
  name: string;
  src: string;
  category: 'attendee' | 'partner';
}

export interface KioskStats {
  attendeeCount: number;
  partnerCount: number;
}
