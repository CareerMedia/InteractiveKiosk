import type { LogoItem } from '../types';

type RawModuleMap = Record<string, string>;

const attendeeModules: RawModuleMap = {
  ...(import.meta.glob('../assets/employers/attendees/*.png', {
    eager: true,
    import: 'default',
  }) as RawModuleMap),
  ...(import.meta.glob('../assets/employers/attendees/*.PNG', {
    eager: true,
    import: 'default',
  }) as RawModuleMap),
  ...(import.meta.glob('../assets/employers/attendees/*.jpg', {
    eager: true,
    import: 'default',
  }) as RawModuleMap),
  ...(import.meta.glob('../assets/employers/attendees/*.JPG', {
    eager: true,
    import: 'default',
  }) as RawModuleMap),
  ...(import.meta.glob('../assets/employers/attendees/*.jpeg', {
    eager: true,
    import: 'default',
  }) as RawModuleMap),
  ...(import.meta.glob('../assets/employers/attendees/*.JPEG', {
    eager: true,
    import: 'default',
  }) as RawModuleMap),
  ...(import.meta.glob('../assets/employers/attendees/*.svg', {
    eager: true,
    import: 'default',
  }) as RawModuleMap),
  ...(import.meta.glob('../assets/employers/attendees/*.SVG', {
    eager: true,
    import: 'default',
  }) as RawModuleMap),
  ...(import.meta.glob('../assets/employers/attendees/*.webp', {
    eager: true,
    import: 'default',
  }) as RawModuleMap),
  ...(import.meta.glob('../assets/employers/attendees/*.WEBP', {
    eager: true,
    import: 'default',
  }) as RawModuleMap),
  ...(import.meta.glob('../assets/employers/attendees/*.avif', {
    eager: true,
    import: 'default',
  }) as RawModuleMap),
  ...(import.meta.glob('../assets/employers/attendees/*.AVIF', {
    eager: true,
    import: 'default',
  }) as RawModuleMap),
};

const partnerModules: RawModuleMap = {
  ...(import.meta.glob('../assets/employers/partners/*.png', {
    eager: true,
    import: 'default',
  }) as RawModuleMap),
  ...(import.meta.glob('../assets/employers/partners/*.PNG', {
    eager: true,
    import: 'default',
  }) as RawModuleMap),
  ...(import.meta.glob('../assets/employers/partners/*.jpg', {
    eager: true,
    import: 'default',
  }) as RawModuleMap),
  ...(import.meta.glob('../assets/employers/partners/*.JPG', {
    eager: true,
    import: 'default',
  }) as RawModuleMap),
  ...(import.meta.glob('../assets/employers/partners/*.jpeg', {
    eager: true,
    import: 'default',
  }) as RawModuleMap),
  ...(import.meta.glob('../assets/employers/partners/*.JPEG', {
    eager: true,
    import: 'default',
  }) as RawModuleMap),
  ...(import.meta.glob('../assets/employers/partners/*.svg', {
    eager: true,
    import: 'default',
  }) as RawModuleMap),
  ...(import.meta.glob('../assets/employers/partners/*.SVG', {
    eager: true,
    import: 'default',
  }) as RawModuleMap),
  ...(import.meta.glob('../assets/employers/partners/*.webp', {
    eager: true,
    import: 'default',
  }) as RawModuleMap),
  ...(import.meta.glob('../assets/employers/partners/*.WEBP', {
    eager: true,
    import: 'default',
  }) as RawModuleMap),
  ...(import.meta.glob('../assets/employers/partners/*.avif', {
    eager: true,
    import: 'default',
  }) as RawModuleMap),
  ...(import.meta.glob('../assets/employers/partners/*.AVIF', {
    eager: true,
    import: 'default',
  }) as RawModuleMap),
};

function formatName(filePath: string): string {
  const rawName = filePath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'Logo';
  return rawName
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeId(filePath: string): string {
  return filePath
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function loadLogoAssets(category: 'attendee' | 'partner'): LogoItem[] {
  const modules = category === 'attendee' ? attendeeModules : partnerModules;

  return Object.entries(modules)
    .map(([path, src]) => ({
      id: normalizeId(path),
      name: formatName(path),
      src,
      category,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
