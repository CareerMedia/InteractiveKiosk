import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HomeScreen } from './components/HomeScreen';
import { InstagramPopup } from './components/InstagramPopup';
import { MapScreen } from './components/MapScreen';
import { PartnerRail } from './components/PartnerRail';
import { KIOSK_CONFIG } from './config/kiosk';
import { MAP_CONFIG } from './config/map';
import { useInactivityTimer } from './hooks/useInactivityTimer';
import { loadLogoAssets } from './utils/assetLoader';
import type { KioskMode } from './types';

function App() {
  const attendeeLogos = useMemo(() => loadLogoAssets('attendee'), []);
  const partnerLogos = useMemo(() => loadLogoAssets('partner'), []);

  const [mode, setMode] = useState<KioskMode>('home');
  const [sessionNumber, setSessionNumber] = useState(0);
  const [popupVisible, setPopupVisible] = useState(false);
  const popupShownRef = useRef(false);

  const goHome = useCallback(() => {
    setMode('home');
    setPopupVisible(false);
    popupShownRef.current = false;
  }, []);

  const { reset, secondsRemaining } = useInactivityTimer({
    active: mode === 'map',
    timeoutMs: KIOSK_CONFIG.inactivityTimeoutMs,
    onTimeout: goHome,
  });

  const startSession = useCallback(() => {
    popupShownRef.current = false;
    setPopupVisible(false);
    setSessionNumber((current) => current + 1);
    setMode('map');
  }, []);

  const closePopup = useCallback(() => {
    setPopupVisible(false);
    reset();
  }, [reset]);

  useEffect(() => {
    if (mode !== 'map') {
      return;
    }

    const popupTimer = window.setTimeout(() => {
      if (!popupShownRef.current) {
        popupShownRef.current = true;
        setPopupVisible(true);
      }
    }, KIOSK_CONFIG.popupDelayMs);

    return () => {
      window.clearTimeout(popupTimer);
    };
  }, [mode, sessionNumber]);

  useEffect(() => {
    if (!popupVisible) {
      return;
    }

    const autoCloseTimer = window.setTimeout(() => {
      setPopupVisible(false);
      reset();
    }, KIOSK_CONFIG.popupAutoCloseMs);

    return () => {
      window.clearTimeout(autoCloseTimer);
    };
  }, [popupVisible, reset]);

  useEffect(() => {
    const handleMappedinMessage = (event: MessageEvent) => {
      if (event.origin !== MAP_CONFIG.origin || mode !== 'map') {
        return;
      }

      if (!event.data || typeof event.data !== 'object') {
        return;
      }

      const messageType = (event.data as { type?: unknown }).type;
      if (messageType === 'app-loaded' || messageType === 'state-changed') {
        reset();
      }
    };

    window.addEventListener('message', handleMappedinMessage);
    return () => {
      window.removeEventListener('message', handleMappedinMessage);
    };
  }, [mode, reset]);

  const stats = useMemo(
    () => ({
      attendeeCount: attendeeLogos.length,
      partnerCount: partnerLogos.length,
    }),
    [attendeeLogos.length, partnerLogos.length],
  );

  return (
    <div className={`app-shell mode-${mode}`}>
      <div className="ambient-glow ambient-glow-left" aria-hidden="true" />
      <div className="ambient-glow ambient-glow-right" aria-hidden="true" />
      <div className="scan-lines" aria-hidden="true" />

      <PartnerRail logos={partnerLogos} compact={mode === 'map'} />

      <main className={`content-shell ${mode === 'map' ? 'map-active' : ''}`}>
        {mode === 'home' ? (
          <HomeScreen attendeeLogos={attendeeLogos} stats={stats} onStart={startSession} />
        ) : (
          <MapScreen
            secondsRemaining={secondsRemaining}
            onReturnHome={goHome}
            onMapFramePointerActivity={reset}
          />
        )}
      </main>

      <InstagramPopup visible={popupVisible} onClose={closePopup} />
    </div>
  );
}

export default App;
