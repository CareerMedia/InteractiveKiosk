/**
 * Replace MAP_EMBED_URL whenever you need to point the kiosk at a new Mappedin map.
 *
 * Original embed reference supplied for the project:
 * <iframe href="https://www.mappedin.com/" title="Mappedin Map" name="Mappedin Map"
 * allow="clipboard-write 'self' https://app.mappedin.com; web-share 'self' https://app.mappedin.com"
 * scrolling="no" width="100%" height="650" frameborder="0" style="border:0"
 * src="https://app.mappedin.com/map/67be0704561935000b3e6cbb?embedded=true"></iframe>
 */
export const MAP_EMBED_URL = 'https://app.mappedin.com/map/67be0704561935000b3e6cbb?embedded=true';

export const MAP_CONFIG = {
  title: 'Mappedin Map',
  iframeName: 'Mappedin Map',
  sourceAttributionHref: 'https://www.mappedin.com/',
  allowPermissions:
    "clipboard-write 'self' https://app.mappedin.com; web-share 'self' https://app.mappedin.com",
  origin: 'https://app.mappedin.com',
} as const;

export function getMapEmbedUrl(): string {
  const url = new URL(MAP_EMBED_URL);
  if (!url.searchParams.has('embedded')) {
    url.searchParams.set('embedded', 'true');
  }
  if (!url.searchParams.has('kiosk')) {
    url.searchParams.set('kiosk', 'true');
  }
  return url.toString();
}
