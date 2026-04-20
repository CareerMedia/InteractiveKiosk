import { useEffect, useMemo, useState } from 'react';
import { KIOSK_CONFIG } from '../config/kiosk';
import { useViewportLayout } from '../hooks/useViewportLayout';
import type { LogoItem } from '../types';

interface LogoWallProps {
  logos: LogoItem[];
}

function chunkLogos(logos: LogoItem[], chunkSize: number): LogoItem[][] {
  if (logos.length === 0) {
    return [];
  }

  const pages: LogoItem[][] = [];

  for (let index = 0; index < logos.length; index += chunkSize) {
    pages.push(logos.slice(index, index + chunkSize));
  }

  return pages;
}

export function LogoWall({ logos }: LogoWallProps) {
  const { isLandscape } = useViewportLayout();
  const [pageIndex, setPageIndex] = useState(0);

  const logosPerPage = isLandscape
    ? KIOSK_CONFIG.attendeeLogosPerPageLandscape
    : KIOSK_CONFIG.attendeeLogosPerPagePortrait;

  const pages = useMemo(() => chunkLogos(logos, logosPerPage), [logos, logosPerPage]);

  useEffect(() => {
    setPageIndex(0);
  }, [logosPerPage]);

  useEffect(() => {
    if (pages.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setPageIndex((currentIndex) => (currentIndex + 1) % pages.length);
    }, KIOSK_CONFIG.logoPageDurationMs);

    return () => window.clearInterval(intervalId);
  }, [pages.length]);

  if (logos.length === 0) {
    return (
      <div className="logo-wall-empty">
        <h3>Drop attendee employer logos into the repo to populate this wall.</h3>
        <p>
          Add files to <code>src/assets/employers/attendees</code> and the kiosk will pull them in
          automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="logo-wall">
      {pages.map((page, index) => {
        const isActive = index === pageIndex;
        return (
          <div
            key={`logo-page-${index}`}
            className={`logo-page ${isActive ? 'is-active' : ''}`}
            aria-hidden={!isActive}
          >
            {page.map((logo) => (
              <div className="logo-card" key={logo.id}>
                <img src={logo.src} alt={logo.name} className="logo-image" loading="lazy" />
              </div>
            ))}
          </div>
        );
      })}
      {pages.length > 1 && (
        <div className="page-dots" aria-label="Employer logo carousel pagination">
          {pages.map((_, index) => (
            <span key={`dot-${index}`} className={index === pageIndex ? 'is-active' : ''} />
          ))}
        </div>
      )}
    </div>
  );
}
