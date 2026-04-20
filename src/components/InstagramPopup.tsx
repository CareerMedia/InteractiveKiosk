import instagramQr from '../assets/qr/instagram-qr.png';
import { KIOSK_CONFIG } from '../config/kiosk';
import { ConfettiRain } from './ConfettiRain';

interface InstagramPopupProps {
  visible: boolean;
  onClose: () => void;
}

export function InstagramPopup({ visible, onClose }: InstagramPopupProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="popup-backdrop" role="dialog" aria-modal="true" aria-labelledby="instagram-popup-title">
      <ConfettiRain />
      <div className="popup-shell">
        <div className="popup-badge">Follow us</div>
        <h2 id="instagram-popup-title">{KIOSK_CONFIG.instagramPopupTitle}</h2>
        <p className="popup-copy">{KIOSK_CONFIG.instagramHeadline}</p>
        <div className="popup-card">
          <div className="popup-qr-wrap">
            <img src={instagramQr} alt="Instagram QR code for CSUN Career Center" className="popup-qr" />
          </div>
          <div className="popup-text-wrap">
            <div className="popup-handle">{KIOSK_CONFIG.instagramHandle}</div>
            <p>{KIOSK_CONFIG.instagramPopupBody}</p>
            <a
              href={KIOSK_CONFIG.instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="popup-link"
            >
              Open Instagram
            </a>
          </div>
        </div>
        <button className="ghost-button" onClick={onClose} type="button">
          Continue to map
        </button>
      </div>
    </div>
  );
}
