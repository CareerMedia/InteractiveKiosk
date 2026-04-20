import careerCenterLogo from '../assets/branding/csun-career-center-logo.png';
import { KIOSK_CONFIG } from '../config/kiosk';
import type { KioskStats, LogoItem } from '../types';
import { LogoWall } from './LogoWall';

interface HomeScreenProps {
  attendeeLogos: LogoItem[];
  stats: KioskStats;
  onStart: () => void;
}

export function HomeScreen({ attendeeLogos, stats, onStart }: HomeScreenProps) {
  return (
    <section className="home-screen" aria-label="Interactive kiosk home screen">
      <div className="hero-panel glass-panel">
        <img
          src={careerCenterLogo}
          alt="CSUN Career Center logo"
          className="hero-logo"
        />
        <div className="hero-copy-wrap">
          <span className="hero-kicker">Career Fair Experience</span>
          <h1>{KIOSK_CONFIG.eventTitle}</h1>
          <p>{KIOSK_CONFIG.eventSubtitle}</p>
        </div>
      </div>

      <div className="showcase-panel glass-panel">
        <div className="showcase-header">
          <div>
            <span className="hero-kicker">Attending employers</span>
            <h2>Meet today&apos;s employers</h2>
          </div>
          <div className="stats-row">
            <div className="stat-pill">
              <strong>{stats.attendeeCount}</strong>
              <span>Attendees</span>
            </div>
            <div className="stat-pill">
              <strong>{stats.partnerCount}</strong>
              <span>Partners</span>
            </div>
          </div>
        </div>
        <LogoWall logos={attendeeLogos} />
      </div>

      <div className="cta-dock glass-panel">
        <div>
          <div className="cta-title">Open the event map</div>
          <p>{KIOSK_CONFIG.startButtonSubcopy}</p>
        </div>
        <button className="primary-button" onClick={onStart} type="button">
          {KIOSK_CONFIG.startButtonLabel}
        </button>
      </div>
    </section>
  );
}
