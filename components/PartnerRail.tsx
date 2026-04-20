import type { LogoItem } from '../types';

interface PartnerRailProps {
  logos: LogoItem[];
  compact?: boolean;
}

export function PartnerRail({ logos, compact = false }: PartnerRailProps) {
  const shouldAnimate = logos.length > 4;
  const repeatedLogos = shouldAnimate ? [...logos, ...logos] : logos;

  return (
    <section className={`partner-rail ${compact ? 'is-compact' : ''}`} aria-label="Employer partners">
      <div className="partner-heading-wrap">
        <span className="partner-eyebrow">Featured employer partners</span>
        <h2>Employer Partners</h2>
      </div>
      <div className="partner-track-shell">
        {logos.length === 0 ? (
          <div className="partner-empty">
            Add partner logos to <code>src/assets/employers/partners</code>
          </div>
        ) : (
          <div className={`partner-track ${shouldAnimate ? '' : 'is-static'}`}>
            {repeatedLogos.map((logo, index) => (
              <div className="partner-chip" key={`${logo.id}-${index}`}>
                <img src={logo.src} alt={logo.name} className="partner-logo" loading="lazy" />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
