import { ServiceLocation } from '../types/queue';
import { BANK_BRANCHES } from './bankCatalog';

export type DiscoveryCategoryId = 'banking';

export interface DiscoveryCategory {
  id: DiscoveryCategoryId;
  name: string;
  description: string;
}

export interface DiscoverySubService {
  id: string;
  name: string;
  description: string;
  queueServiceId: string;
  prefix: string;
  avgServiceMinutes: number;
  counters: string[];
  reasonLabel: string;
  reasonPlaceholder: string;
  documentChecklist: string;
}

export interface DiscoveryLocation {
  id: string;
  categoryId: DiscoveryCategoryId;
  name: string;
  address: string;
  city: string;
  area: string;
  hours: string;
  coords: { lat: number; lng: number };
  mapPos: { x: number; y: number };
  isDemoLocation: boolean;
  services: DiscoverySubService[];
}

export interface TicketBookingMeta {
  ticketId: string;
  locationId: string;
  locationName: string;
  locationAddress: string;
  categoryName: string;
  subServiceName: string;
  reason?: string;
  referenceValue?: string;
  createdAt: number;
}

export const DISCOVERY_CATEGORIES: DiscoveryCategory[] = [
  {
    id: 'banking',
    name: 'Bank Branches',
    description:
      'Participating Karnataka bank branches for customer service, account opening, cash counters, and loan advisory.',
  },
];

export const DISCOVERY_LOCATIONS: DiscoveryLocation[] = BANK_BRANCHES.map((branch) => ({
  id: branch.id,
  categoryId: 'banking',
  name: branch.displayName,
  address: branch.address,
  city: branch.city,
  area: branch.area,
  hours: branch.hours,
  coords: branch.coords,
  mapPos: branch.mapPos,
  isDemoLocation: branch.isDemoBranch,
  services: branch.desks.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    queueServiceId: d.queueServiceId,
    prefix: d.prefix,
    avgServiceMinutes: d.avgServiceMinutes,
    counters: d.counters,
    reasonLabel: d.reasonLabel,
    reasonPlaceholder: d.reasonPlaceholder,
    documentChecklist: d.documentChecklist,
  })),
}));

export function getCategoryById(id: DiscoveryCategoryId): DiscoveryCategory | undefined {
  return DISCOVERY_CATEGORIES.find((c) => c.id === id);
}

export function findCatalogMatchByServiceId(serviceId: string): {
  location: DiscoveryLocation;
  subService: DiscoverySubService;
  category: DiscoveryCategory;
} | null {
  for (const location of DISCOVERY_LOCATIONS) {
    const sub = location.services.find((s) => s.queueServiceId === serviceId);
    if (sub) {
      const category = getCategoryById(location.categoryId);
      if (category) {
        return { location, subService: sub, category };
      }
    }
  }
  return null;
}

export function getActiveServicesForLocation(
  location: DiscoveryLocation,
  queueServices: ServiceLocation[]
): ServiceLocation[] {
  const byId = new Map(queueServices.map((s) => [s.id, s]));
  const matched: ServiceLocation[] = [];
  for (const sub of location.services) {
    const svc = byId.get(sub.queueServiceId);
    if (svc) matched.push(svc);
  }
  return matched;
}

export function buildGoogleMapsDirectionsUrl(location: DiscoveryLocation): string | null {
  const query = location.address?.trim() || `${location.name}, ${location.city}`;
  if (!query) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}

const TICKET_META_KEY = 'lineless_visitor_ticket_meta_v1';

export function saveTicketBookingMeta(meta: TicketBookingMeta): void {
  try {
    const raw = localStorage.getItem(TICKET_META_KEY);
    const map: Record<string, TicketBookingMeta> = raw ? JSON.parse(raw) : {};
    map[meta.ticketId] = meta;
    localStorage.setItem(TICKET_META_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage failures
  }
}

export function loadTicketBookingMetaMap(): Record<string, TicketBookingMeta> {
  try {
    const raw = localStorage.getItem(TICKET_META_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
