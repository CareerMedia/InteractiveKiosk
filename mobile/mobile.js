// Mobile view: just loads the Mappedin map (admin-managed URL in
// config.json → bundled default), with an overlay spinner that fades
// out once the iframe has loaded.
import { loadConfig, buildMapUrl } from '../src/shared/config.js';

const mapEl     = document.getElementById('m-map');
const loadingEl = document.getElementById('m-loading');

async function init() {
  if (!mapEl) return;
  mapEl.addEventListener('load', () => {
    if (loadingEl) loadingEl.classList.add('is-hidden');
  }, { once: true });

  const cfg = await loadConfig();
  mapEl.src = buildMapUrl(cfg.mapUrl);
}

init();
