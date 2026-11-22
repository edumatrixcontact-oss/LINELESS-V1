import { ServiceLocation } from '../types/queue';
import { BANK_BRANCHES, DEMO_BRANCH_ID, DEMO_DESK_ID } from './bankCatalog';

export interface ServiceSeedDefinition {
  id: string;
  name: string;
  facility: string;
  locationDetail: string;
  prefix: string;
  avgServiceMinutes: number;
  counters: string[];
  nextSequence: number;
}

export const DEFAULT_SERVICES: ServiceSeedDefinition[] = BANK_BRANCHES.flatMap((branch) =>
  branch.desks.map((desk) => ({
    id: desk.queueServiceId,
    name: desk.name,
    facility: branch.displayName,
    locationDetail: branch.address,
    prefix: desk.prefix,
    avgServiceMinutes: desk.avgServiceMinutes,
    counters: [...desk.counters],
    nextSequence: desk.nextSequence,
  }))
);

export interface StarterTicketSeed {
  id: string;
  ticketNumber: string;
  serviceId: string;
  visitorName: string;
  channel: 'digital' | 'walk-in';
  status: 'waiting' | 'called' | 'serving' | 'completed';
  counter: string | null;
  reason?: string;
}

export const STARTER_WALKIN_TICKETS: StarterTicketSeed[] = [
  {
    id: 't-b-104',
    ticketNumber: 'B-104',
    serviceId: DEMO_DESK_ID,
    visitorName: 'Ramesh Rao',
    channel: 'walk-in',
    status: 'completed',
    counter: 'Counter 1',
    reason: 'Account statement verification',
  },
  {
    id: 't-b-105',
    ticketNumber: 'B-105',
    serviceId: DEMO_DESK_ID,
    visitorName: 'Ananya Deshpande',
    channel: 'digital',
    status: 'serving',
    counter: 'Counter 2',
    reason: 'Debit card replacement',
  },
  {
    id: 't-b-106',
    ticketNumber: 'B-106',
    serviceId: DEMO_DESK_ID,
    visitorName: 'Karthik Gowda',
    channel: 'digital',
    status: 'waiting',
    counter: null,
    reason: 'Passbook update',
  },
  {
    id: 't-b-107',
    ticketNumber: 'B-107',
    serviceId: DEMO_DESK_ID,
    visitorName: 'Walk-in',
    channel: 'walk-in',
    status: 'waiting',
    counter: null,
    reason: 'Cheque book request',
  },
  {
    id: 't-ao-101',
    ticketNumber: 'AO-101',
    serviceId: 'bank-lalbagh-acc',
    visitorName: 'Sneha Kulkarni',
    channel: 'digital',
    status: 'serving',
    counter: 'Desk 3',
    reason: 'Open a new savings account',
  },
  {
    id: 't-ao-102',
    ticketNumber: 'AO-102',
    serviceId: 'bank-lalbagh-acc',
    visitorName: 'Vikram Hegde',
    channel: 'walk-in',
    status: 'waiting',
    counter: null,
    reason: 'KYC verification',
  },
  {
    id: 't-cs-101',
    ticketNumber: 'CS-101',
    serviceId: 'bank-lalbagh-cash',
    visitorName: 'Manjunath Bhat',
    channel: 'walk-in',
    status: 'called',
    counter: 'Teller 1',
    reason: 'Demand draft issuance',
  },
  {
    id: 't-cs-102',
    ticketNumber: 'CS-102',
    serviceId: 'bank-lalbagh-cash',
    visitorName: 'Meera Joshi',
    channel: 'digital',
    status: 'waiting',
    counter: null,
    reason: 'Cash deposit slip',
  },
  {
    id: 't-la-101',
    ticketNumber: 'LA-101',
    serviceId: 'bank-lalbagh-loan',
    visitorName: 'Prakash Shetty',
    channel: 'digital',
    status: 'waiting',
    counter: null,
    reason: 'Home loan documentation',
  },
  {
    id: 't-cn-101',
    ticketNumber: 'CN-101',
    serviceId: 'bank-canara-cs',
    visitorName: 'Deepak Nair',
    channel: 'digital',
    status: 'serving',
    counter: 'Desk 1',
    reason: 'Mobile number update',
  },
  {
    id: 't-cn-102',
    ticketNumber: 'CN-102',
    serviceId: 'bank-canara-cs',
    visitorName: 'Lakshmi Iyer',
    channel: 'walk-in',
    status: 'waiting',
    counter: null,
    reason: 'Passbook printing',
  },
  {
    id: 't-sb-101',
    ticketNumber: 'SB-101',
    serviceId: 'bank-sbi-cs',
    visitorName: 'Gopalakrishna Murthy',
    channel: 'walk-in',
    status: 'serving',
    counter: 'Counter 1',
    reason: 'Pension life certificate',
  },
  {
    id: 't-sb-102',
    ticketNumber: 'SB-102',
    serviceId: 'bank-sbi-cs',
    visitorName: 'Divya Menon',
    channel: 'digital',
    status: 'waiting',
    counter: null,
    reason: 'KYC re-verification',
  },
  {
    id: 't-hd-101',
    ticketNumber: 'HD-101',
    serviceId: 'bank-hdfc-acc',
    visitorName: 'Rohan Sharma',
    channel: 'digital',
    status: 'waiting',
    counter: null,
    reason: 'Salary account onboarding',
  },
];

export const INITIAL_DEMO_BRANCH_ID = DEMO_BRANCH_ID;

export function toInitialServicePreview(): ServiceLocation[] {
  const now = Date.now();
  return DEFAULT_SERVICES.map((s) => ({
    ...s,
    isPaused: false,
    updatedAt: now,
  }));
}
