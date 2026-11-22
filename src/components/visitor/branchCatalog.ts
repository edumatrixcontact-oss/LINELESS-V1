import { CreateServiceInput } from '../../context/QueueContext';
import { BANK_BRANCHES } from '../../data/bankCatalog';
import {
  DISCOVERY_LOCATIONS,
  DiscoveryLocation,
  buildGoogleMapsDirectionsUrl,
  getCategoryById,
} from '../../data/discoveryCatalog';
import { Announcement, QueueFeedItem, ServiceLocation } from '../../types/queue';

export interface VisitorDeskItem {
  serviceId: string;
  name: string;
  description: string;
  documentChecklist?: string;
  prefix: string;
  counters: string[];
  avgServiceMinutes: number;
  isLive: boolean;
  isPaused: boolean;
  canBook: boolean;
  waitingCount: number;
  nowServing: QueueFeedItem[];
  estimatedWaitMinutes: number | null;
  waitDisplay: string;
  demoCatalogSeed?: CreateServiceInput & { id: string };
}

export interface VisitorBranchItem {
  branchKey: string;
  bankName: string;
  branchName: string;
  locationName: string;
  address: string;
  area: string;
  city: string;
  hours: string | null;
  categoryId: string;
  categoryName: string;
  isBankDesk: boolean;
  mapsUrl: string | null;
  desks: VisitorDeskItem[];
  announcements: Announcement[];
}

export function buildVisitorBranchCatalog(params: {
  services: ServiceLocation[];
  queueFeed: QueueFeedItem[];
  announcements: Announcement[];
  isDemoVisitor: boolean;
}): VisitorBranchItem[] {
  const { services, queueFeed, announcements, isDemoVisitor } = params;
  const serviceById = new Map(services.map((s) => [s.id, s]));
  const knownServiceIds = new Set<string>();
  const now = Date.now();
  const activeAnnouncements = announcements.filter(
    (a) => !a.expiresAt || a.expiresAt > now
  );

  const makeDeskMetrics = (
    serviceId: string,
    liveSvc: ServiceLocation | undefined,
    fallbackAvg: number,
    fallbackCounters: string[]
  ) => {
    const waiting = queueFeed.filter(
      (f) => f.serviceId === serviceId && f.status === 'waiting'
    );
    const nowServing = queueFeed.filter(
      (f) => f.serviceId === serviceId && (f.status === 'serving' || f.status === 'called')
    );

    if (!liveSvc) {
      return {
        isLive: false,
        isPaused: false,
        canBook: isDemoVisitor,
        waitingCount: 0,
        nowServing: [] as QueueFeedItem[],
        estimatedWaitMinutes: null as number | null,
        waitDisplay: 'Wait estimate unavailable',
      };
    }

    if (liveSvc.isPaused) {
      return {
        isLive: true,
        isPaused: true,
        canBook: false,
        waitingCount: waiting.length,
        nowServing,
        estimatedWaitMinutes: null as number | null,
        waitDisplay: 'Queue paused',
      };
    }

    const countersCount = Math.max(1, liveSvc.counters.length || fallbackCounters.length || 1);
    const avgMin = liveSvc.avgServiceMinutes || fallbackAvg || 6;
    const estWait =
      waiting.length === 0 ? 0 : Math.max(2, Math.round((waiting.length * avgMin) / countersCount));

    return {
      isLive: true,
      isPaused: false,
      canBook: true,
      waitingCount: waiting.length,
      nowServing,
      estimatedWaitMinutes: estWait,
      waitDisplay: waiting.length === 0 ? 'No wait right now' : `About ${estWait} min`,
    };
  };

  const bankMetaById = new Map(BANK_BRANCHES.map((b) => [b.id, b]));

  const catalogBranches: VisitorBranchItem[] = DISCOVERY_LOCATIONS.map((loc: DiscoveryLocation) => {
    const category = getCategoryById(loc.categoryId);
    const bankMeta = bankMetaById.get(loc.id);
    const desks: VisitorDeskItem[] = loc.services.map((sub) => {
      knownServiceIds.add(sub.queueServiceId);
      const liveSvc = serviceById.get(sub.queueServiceId);
      const metrics = makeDeskMetrics(
        sub.queueServiceId,
        liveSvc,
        sub.avgServiceMinutes,
        sub.counters
      );
      return {
        serviceId: sub.queueServiceId,
        name: liveSvc?.name || sub.name,
        description: sub.description,
        documentChecklist: sub.documentChecklist,
        prefix: liveSvc?.prefix || sub.prefix,
        counters: liveSvc?.counters?.length ? liveSvc.counters : sub.counters,
        avgServiceMinutes: liveSvc?.avgServiceMinutes || sub.avgServiceMinutes,
        ...metrics,
        demoCatalogSeed: {
          id: sub.queueServiceId,
          name: sub.name,
          facility: loc.name,
          locationDetail: loc.address,
          prefix: sub.prefix,
          avgServiceMinutes: sub.avgServiceMinutes,
          counters: sub.counters,
        },
      };
    });

    const deskServiceIds = new Set(desks.map((d) => d.serviceId));
    const branchAnnouncements = activeAnnouncements.filter(
      (a) => a.serviceId === 'all' || deskServiceIds.has(a.serviceId)
    );

    return {
      branchKey: loc.id,
      bankName: bankMeta?.bankName || loc.name,
      branchName: bankMeta?.branchName || loc.area,
      locationName: loc.name,
      address: loc.address,
      area: loc.area,
      city: loc.city,
      hours: loc.hours || null,
      categoryId: loc.categoryId,
      categoryName: category?.name || 'Bank Branch',
      isBankDesk: true,
      mapsUrl: buildGoogleMapsDirectionsUrl(loc),
      desks,
      announcements: branchAnnouncements,
    };
  });

  const customGrouped = new Map<string, ServiceLocation[]>();
  for (const svc of services) {
    if (knownServiceIds.has(svc.id)) continue;
    const key = svc.facility.trim().toLowerCase() || svc.id;
    const group = customGrouped.get(key) || [];
    group.push(svc);
    customGrouped.set(key, group);
  }

  const customBranches: VisitorBranchItem[] = Array.from(customGrouped.values()).map((group) => {
    const primary = group[0];
    const desks: VisitorDeskItem[] = group.map((svc) => {
      const metrics = makeDeskMetrics(svc.id, svc, svc.avgServiceMinutes, svc.counters);
      return {
        serviceId: svc.id,
        name: svc.name,
        description: `${svc.facility} desk (${svc.counters.join(', ')})`,
        prefix: svc.prefix,
        counters: svc.counters,
        avgServiceMinutes: svc.avgServiceMinutes,
        ...metrics,
      };
    });
    const deskServiceIds = new Set(desks.map((d) => d.serviceId));
    return {
      branchKey: `custom-${primary.id}`,
      bankName: primary.facility,
      branchName: primary.locationDetail,
      locationName: primary.facility,
      address: primary.locationDetail,
      area: '',
      city: '',
      hours: null,
      categoryId: 'banking',
      categoryName: 'Bank Branch',
      isBankDesk: true,
      mapsUrl: null,
      desks,
      announcements: activeAnnouncements.filter(
        (a) => a.serviceId === 'all' || deskServiceIds.has(a.serviceId)
      ),
    };
  });

  return [...catalogBranches, ...customBranches];
}

export function findBranchForServiceId(
  branches: VisitorBranchItem[],
  serviceId?: string | null
): { branch: VisitorBranchItem; desk: VisitorDeskItem } | null {
  if (!serviceId) return null;
  for (const branch of branches) {
    const desk = branch.desks.find((d) => d.serviceId === serviceId);
    if (desk) return { branch, desk };
  }
  return null;
}

export function formatCounterTurnText(counter: string | null | undefined): string {
  const clean = counter?.trim();
  if (!clean) return "It's your turn";
  if (/^(counter|desk|teller|advisory)\b/i.test(clean)) {
    return `It's your turn · ${clean}`;
  }
  return `It's your turn · Counter ${clean}`;
}
