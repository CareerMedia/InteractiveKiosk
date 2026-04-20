import { useMemo, useRef } from 'react';
import careerCenterLogo from '../assets/branding/csun-career-center-logo.png';
import { KIOSK_CONFIG } from '../config/kiosk';
import { getMapEmbedUrl, MAP_CONFIG } from '../config/map';

interface MapScreenProps {
  secondsRemaining: number;
  onReturnHome: () => void;
  onMapFramePointerActivity: () => void;
}

export function MapScreen({
  secondsRemaining,
  onReturnHome,
  onMapFramePointerActivity,
}: MapScreenProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const mapUrl = useMemo(() => getMapEmbedUrl(), []);

  return (
    <section className="map-screen" aria-label="Interactive map view">
      <div className="map-overlay-controls">
        <div className="map-brand-chip glass-panel compact-panel">
          <img src={careerCenterLogo} alt="CSUN Career Center logo" className="map-brand-logo" />
          <div>
            <strong>Event Map</strong>
            <span>{KIOSK_CONFIG.kioskReturnMessage}</span>
          </div>
        </div>
        <div className="map-action-group">
          <div className="countdown-pill glass-panel compact-panel" aria-live="polite">
            Home in {secondsRemaining}s
          </div>
          <button className="secondary-button glass-panel compact-panel" onClick={onReturnHome} type="button">
            Return Home
          </button>
        </div>
      </div>
      <div className="map-frame-shell">
        <iframe
          ref={iframeRef}
          title={MAP_CONFIG.title}
          name={MAP_CONFIG.iframeName}
          allow={MAP_CONFIG.allowPermissions}
          scrolling="no"
          width="100%"
          height="100%"
          frameBorder="0"
          style={{ border: 0 }}
          src={mapUrl}
          className="map-frame"
          onMouseEnter={onMapFramePointerActivity}
          onPointerDown={onMapFramePointerActivity}
          onTouchStart={onMapFramePointerActivity}
        />
      </div>
    </section>
  );
}
