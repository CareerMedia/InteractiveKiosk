import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  emptyAdsData,
  filterActiveAds,
  ADS_JSON_PATH,
  ADS_DIR,
  createAdId,
  makeAdFilename,
  validateAdFile,
  detectAdType,
} from '../../src/shared/ads-constants.js';
import { isEphemeralRuntime } from './jobs-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
export const ADS_PATH = path.join(ROOT, ADS_JSON_PATH);
export const ADS_MEDIA_DIR = path.join(ROOT, ADS_DIR);
export { ADS_JSON_PATH, ADS_DIR };

export async function readAds() {
  try {
    const raw = await fs.readFile(ADS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return emptyAdsData();
  }
}

export async function writeAds(data) {
  if (isEphemeralRuntime()) return;
  await fs.mkdir(path.dirname(ADS_PATH), { recursive: true });
  const next = {
    ...data,
    meta: {
      ...emptyAdsData().meta,
      ...(data.meta || {}),
      lastUpdatedAt: new Date().toISOString(),
      totalAds: (data.ads || []).length,
    },
  };
  await fs.writeFile(ADS_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

export function publicAdsPayload(data) {
  const active = filterActiveAds(data);
  return {
    meta: {
      idleDelayMs: data.meta?.idleDelayMs ?? 180_000,
      imageSlideDurationMs: data.meta?.imageSlideDurationMs ?? 10_000,
      randomize: data.meta?.randomize !== false,
      totalActive: active.length,
      testIdleAdsAt: data.meta?.testIdleAdsAt || null,
    },
    ads: active.map((ad) => ({
      id: ad.id,
      title: ad.title,
      type: ad.type,
      src: ad.src,
      thumbnailSrc: ad.thumbnailSrc || (ad.type === 'image' ? ad.src : ''),
      durationSeconds: ad.durationSeconds ?? null,
      order: ad.order ?? 0,
    })),
  };
}

export function findAdById(data, id) {
  return (data.ads || []).find((ad) => String(ad.id) === String(id)) || null;
}

export function createAdRecord({ title, fileName, fileSize, mimeType, type, src }) {
  const now = new Date().toISOString();
  return {
    id: createAdId(),
    title: String(title || '').trim() || fileName,
    type,
    src,
    thumbnailSrc: type === 'image' ? src : '',
    fileName,
    fileSize: fileSize || 0,
    mimeType: mimeType || '',
    active: true,
    startDate: '',
    endDate: '',
    durationSeconds: null,
    uploadedAt: now,
    updatedAt: now,
    order: 0,
  };
}

export async function saveAdMedia(buffer, originalName, title, mimeType = '') {
  const file = { name: originalName, size: buffer.length, type: mimeType };
  const validation = validateAdFile(file);
  if (!validation.ok) throw new Error(validation.error);

  const safeName = makeAdFilename(title, originalName);
  const type = validation.type;

  if (isEphemeralRuntime()) {
    return { fileName: safeName, src: `/${ADS_DIR}/${safeName}`, type };
  }

  await fs.mkdir(ADS_MEDIA_DIR, { recursive: true });
  const dest = path.join(ADS_MEDIA_DIR, safeName);
  await fs.writeFile(dest, buffer);
  return { fileName: safeName, src: `/${ADS_DIR}/${safeName}`, type };
}

export async function deleteAdMedia(fileName) {
  if (!fileName || isEphemeralRuntime()) return;
  const safe = path.basename(fileName);
  try {
    await fs.unlink(path.join(ADS_MEDIA_DIR, safe));
  } catch {
    /* file may already be gone */
  }
}

export {
  emptyAdsData,
  filterActiveAds,
  validateAdFile,
  detectAdType,
  makeAdFilename,
};
