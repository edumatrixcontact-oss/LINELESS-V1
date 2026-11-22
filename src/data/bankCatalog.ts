import { BankBrandId } from '../components/BankEmblem';

export const DEMO_BRANCH_ID = 'branch-lalbagh';
export const DEMO_DESK_ID = 'bank-lalbagh-cs';
export const DEMO_BRANCH_ACCESS_CODE = '2408';

export interface BankDeskCatalogItem {
  id: string;
  queueServiceId: string;
  name: string;
  description: string;
  prefix: string;
  avgServiceMinutes: number;
  counters: string[];
  nextSequence: number;
  reasonLabel: string;
  reasonPlaceholder: string;
  documentChecklist: string;
}

export interface BankBranchCatalogItem {
  id: string;
  brandId: BankBrandId;
  bankName: string;
  branchName: string;
  displayName: string;
  address: string;
  area: string;
  city: string;
  hours: string;
  coords: { lat: number; lng: number };
  mapPos: { x: number; y: number };
  isDemoBranch: boolean;
  demoAccessCode?: string;
  desks: BankDeskCatalogItem[];
}

export interface AnnouncementTemplate {
  id: string;
  label: string;
  message: string;
}

export const QUICK_ANNOUNCEMENT_TEMPLATES: AnnouncementTemplate[] = [
  {
    id: 'lunch',
    label: 'Lunch break',
    message: 'Counters will pause briefly for lunch. Service resumes at 2:00 PM.',
  },
  {
    id: 'holiday',
    label: 'Holiday closure',
    message: 'Branch operations will close early today ahead of the scheduled bank holiday.',
  },
  {
    id: 'delay',
    label: 'Service delay',
    message: 'Higher customer volume than usual. Thank you for waiting — the next counter is calling shortly.',
  },
  {
    id: 'early',
    label: 'Early closing',
    message: 'New token issuance ends at 3:30 PM today. All active waiting tokens will be served.',
  },
];

export const BANK_BRANCHES: BankBranchCatalogItem[] = [
  {
    id: DEMO_BRANCH_ID,
    brandId: 'karnataka-bank',
    bankName: 'Karnataka Bank',
    branchName: 'Lalbagh Road Branch (Demo)',
    displayName: 'Karnataka Bank — Lalbagh Road Branch',
    address: '48 Lalbagh Road, Sudhama Nagar, Bengaluru',
    area: 'Lalbagh',
    city: 'Bengaluru',
    hours: '09:30 AM – 04:00 PM',
    coords: { lat: 12.9562, lng: 77.5847 },
    mapPos: { x: 42, y: 58 },
    isDemoBranch: true,
    demoAccessCode: DEMO_BRANCH_ACCESS_CODE,
    desks: [
      {
        id: 'desk-lalbagh-cs',
        queueServiceId: DEMO_DESK_ID,
        name: 'Customer Service',
        description: 'Passbook updates, cheque books, card support, KYC updates, and general banking.',
        prefix: 'B',
        avgServiceMinutes: 6,
        counters: ['Counter 1', 'Counter 2'],
        nextSequence: 108,
        reasonLabel: 'Visit reason (optional)',
        reasonPlaceholder: 'e.g., Passbook update or cheque book request',
        documentChecklist:
          'Bring a valid government photo ID (Aadhaar Card or PAN Card) along with your passbook or debit card.',
      },
      {
        id: 'desk-lalbagh-acc',
        queueServiceId: 'bank-lalbagh-acc',
        name: 'Account Opening',
        description: 'New savings, salary, and current account onboarding and KYC verification.',
        prefix: 'AO',
        avgServiceMinutes: 10,
        counters: ['Desk 3', 'Desk 4'],
        nextSequence: 103,
        reasonLabel: 'Account request note (optional)',
        reasonPlaceholder: 'e.g., Open a new savings account',
        documentChecklist:
          'Bring your original Aadhaar Card, PAN Card, proof of current address, and 2 passport-size photographs.',
      },
      {
        id: 'desk-lalbagh-cash',
        queueServiceId: 'bank-lalbagh-cash',
        name: 'Cash Services',
        description: 'Cash deposits, withdrawals, demand drafts, and denomination exchange.',
        prefix: 'CS',
        avgServiceMinutes: 5,
        counters: ['Teller 1', 'Teller 2'],
        nextSequence: 103,
        reasonLabel: 'Cash counter note (optional)',
        reasonPlaceholder: 'e.g., Demand draft or branch cash deposit',
        documentChecklist:
          'Bring your PAN Card for cash deposits above ₹50,000, or your cheque book / withdrawal slip for counter withdrawals.',
      },
      {
        id: 'desk-lalbagh-loan',
        queueServiceId: 'bank-lalbagh-loan',
        name: 'Loan & Advisory',
        description: 'Home, vehicle, and education loan documentation, fixed deposits, and advisory.',
        prefix: 'LA',
        avgServiceMinutes: 12,
        counters: ['Advisory 1'],
        nextSequence: 102,
        reasonLabel: 'Advisory topic (optional)',
        reasonPlaceholder: 'e.g., Home loan document verification',
        documentChecklist:
          'Bring your PAN Card, Aadhaar Card, last 6 months bank statements, and latest salary slips or income proof.',
      },
    ],
  },
  {
    id: 'branch-canara-indiranagar',
    brandId: 'canara-bank',
    bankName: 'Canara Bank',
    branchName: 'Indiranagar 100ft Road Branch',
    displayName: 'Canara Bank — Indiranagar Branch',
    address: '100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru',
    area: 'Indiranagar',
    city: 'Bengaluru',
    hours: '09:30 AM – 04:00 PM',
    coords: { lat: 12.9784, lng: 77.6408 },
    mapPos: { x: 74, y: 28 },
    isDemoBranch: false,
    desks: [
      {
        id: 'desk-canara-cs',
        queueServiceId: 'bank-canara-cs',
        name: 'Customer Service',
        description: 'KYC updates, netbanking reactivation, debit card support, and statements.',
        prefix: 'CN',
        avgServiceMinutes: 7,
        counters: ['Desk 1', 'Desk 2'],
        nextSequence: 103,
        reasonLabel: 'Visit reason (optional)',
        reasonPlaceholder: 'e.g., KYC renewal or mobile number update',
        documentChecklist:
          'Bring your Aadhaar Card, PAN Card, and registered mobile phone for OTP verification.',
      },
      {
        id: 'desk-canara-acc',
        queueServiceId: 'bank-canara-acc',
        name: 'Account & Deposits',
        description: 'New savings accounts, fixed deposits, and term deposit renewals.',
        prefix: 'CA',
        avgServiceMinutes: 9,
        counters: ['Desk 3'],
        nextSequence: 102,
        reasonLabel: 'Account note (optional)',
        reasonPlaceholder: 'e.g., Fixed deposit renewal',
        documentChecklist:
          'Bring your Aadhaar Card, PAN Card, and two passport photographs.',
      },
    ],
  },
  {
    id: 'branch-sbi-jayanagar',
    brandId: 'sbi',
    bankName: 'State Bank of India',
    branchName: 'Jayanagar 4th Block Branch',
    displayName: 'State Bank of India — Jayanagar Branch',
    address: '11th Main, 4th Block, Jayanagar, Bengaluru',
    area: 'Jayanagar',
    city: 'Bengaluru',
    hours: '10:00 AM – 04:00 PM',
    coords: { lat: 12.9299, lng: 77.5838 },
    mapPos: { x: 34, y: 76 },
    isDemoBranch: false,
    desks: [
      {
        id: 'desk-sbi-cs',
        queueServiceId: 'bank-sbi-cs',
        name: 'Customer Service & Pension',
        description: 'Senior citizen pension support, life certificates, and general account queries.',
        prefix: 'SB',
        avgServiceMinutes: 8,
        counters: ['Counter 1', 'Counter 2'],
        nextSequence: 103,
        reasonLabel: 'Visit reason (optional)',
        reasonPlaceholder: 'e.g., Pension life certificate or passbook update',
        documentChecklist:
          'Bring your Aadhaar Card, PAN Card, and SBI passbook or pension book.',
      },
      {
        id: 'desk-sbi-cash',
        queueServiceId: 'bank-sbi-cash',
        name: 'Cash & Demand Drafts',
        description: 'Demand drafts, RTGS/NEFT counter forms, and cash deposits.',
        prefix: 'SC',
        avgServiceMinutes: 6,
        counters: ['Teller 1', 'Teller 2'],
        nextSequence: 102,
        reasonLabel: 'Teller note (optional)',
        reasonPlaceholder: 'e.g., NEFT transfer or demand draft',
        documentChecklist:
          'Bring valid photo ID and beneficiary account details for NEFT/RTGS.',
      },
    ],
  },
  {
    id: 'branch-hdfc-mgroad',
    brandId: 'hdfc',
    bankName: 'HDFC Bank',
    branchName: 'MG Road Branch',
    displayName: 'HDFC Bank — MG Road Branch',
    address: '72 Mahatma Gandhi Road, Bengaluru',
    area: 'MG Road',
    city: 'Bengaluru',
    hours: '09:30 AM – 04:30 PM',
    coords: { lat: 12.9756, lng: 77.6066 },
    mapPos: { x: 54, y: 40 },
    isDemoBranch: false,
    desks: [
      {
        id: 'desk-hdfc-acc',
        queueServiceId: 'bank-hdfc-acc',
        name: 'Account Opening & KYC',
        description: 'Savings and salary account onboarding, KYC re-verification, and card replacement.',
        prefix: 'HD',
        avgServiceMinutes: 8,
        counters: ['Desk 1', 'Desk 2'],
        nextSequence: 102,
        reasonLabel: 'Visit reason (optional)',
        reasonPlaceholder: 'e.g., Salary account KYC or debit card reissue',
        documentChecklist:
          'Bring your original PAN Card, Aadhaar Card, and employer offer letter if opening a corporate salary account.',
      },
      {
        id: 'desk-hdfc-loan',
        queueServiceId: 'bank-hdfc-loan',
        name: 'Loan & Advisory',
        description: 'Personal loan, home loan, and wealth desk appointments.',
        prefix: 'HL',
        avgServiceMinutes: 11,
        counters: ['Advisory 1'],
        nextSequence: 102,
        reasonLabel: 'Advisory note (optional)',
        reasonPlaceholder: 'e.g., Home loan foreclosure or rate review',
        documentChecklist:
          'Bring your loan account number, PAN Card, and last 3 months bank statement.',
      },
    ],
  },
  {
    id: 'branch-icici-koramangala',
    brandId: 'icici',
    bankName: 'ICICI Bank',
    branchName: 'Koramangala 80ft Road Branch',
    displayName: 'ICICI Bank — Koramangala Branch',
    address: '80 Feet Road, 4th Block, Koramangala, Bengaluru',
    area: 'Koramangala',
    city: 'Bengaluru',
    hours: '09:30 AM – 04:30 PM',
    coords: { lat: 12.9352, lng: 77.6245 },
    mapPos: { x: 70, y: 70 },
    isDemoBranch: false,
    desks: [
      {
        id: 'desk-icici-cs',
        queueServiceId: 'bank-icici-cs',
        name: 'Customer Service',
        description: 'Debit card pickup, KYC update, locker inquiries, and remittance support.',
        prefix: 'IC',
        avgServiceMinutes: 7,
        counters: ['Counter 1', 'Counter 2'],
        nextSequence: 102,
        reasonLabel: 'Visit reason (optional)',
        reasonPlaceholder: 'e.g., Forex travel card reload or KYC update',
        documentChecklist:
          'Bring your original PAN Card, Aadhaar Card, and passport for forex services.',
      },
    ],
  },
  {
    id: 'branch-bob-mysuru',
    brandId: 'bob',
    bankName: 'Bank of Baroda',
    branchName: 'Mysuru Sayyaji Rao Road Branch',
    displayName: 'Bank of Baroda — Mysuru Branch',
    address: 'Sayyaji Rao Road, Devaraja Mohalla, Mysuru',
    area: 'Sayyaji Rao Road',
    city: 'Mysuru',
    hours: '10:00 AM – 04:00 PM',
    coords: { lat: 12.3095, lng: 76.6525 },
    mapPos: { x: 20, y: 66 },
    isDemoBranch: false,
    desks: [
      {
        id: 'desk-bob-cs',
        queueServiceId: 'bank-bob-cs',
        name: 'Customer Service',
        description: 'Passbook updates, fixed deposits, cheque clearing, and account services.',
        prefix: 'BB',
        avgServiceMinutes: 7,
        counters: ['Counter 1', 'Counter 2'],
        nextSequence: 102,
        reasonLabel: 'Visit reason (optional)',
        reasonPlaceholder: 'e.g., Passbook update or cheque clearing',
        documentChecklist: 'Bring your Aadhaar Card, PAN Card, and Bank of Baroda passbook.',
      },
    ],
  },
  {
    id: 'branch-union-mangaluru',
    brandId: 'union-bank',
    bankName: 'Union Bank of India',
    branchName: 'Mangaluru Hampankatta Branch',
    displayName: 'Union Bank of India — Mangaluru Branch',
    address: 'Hampankatta Circle, Balmatta Road, Mangaluru',
    area: 'Hampankatta',
    city: 'Mangaluru',
    hours: '10:00 AM – 04:00 PM',
    coords: { lat: 12.8698, lng: 74.843 },
    mapPos: { x: 14, y: 36 },
    isDemoBranch: false,
    desks: [
      {
        id: 'desk-union-cs',
        queueServiceId: 'bank-union-cs',
        name: 'Customer Service',
        description: 'NRI desk, savings accounts, passbooks, and remittance assistance.',
        prefix: 'UB',
        avgServiceMinutes: 8,
        counters: ['Counter 1', 'Counter 2'],
        nextSequence: 102,
        reasonLabel: 'Visit reason (optional)',
        reasonPlaceholder: 'e.g., NRE account KYC or term deposit',
        documentChecklist: 'Bring your passport or Aadhaar Card along with your PAN Card.',
      },
    ],
  },
  {
    id: 'branch-axis-hubballi',
    brandId: 'axis',
    bankName: 'Axis Bank',
    branchName: 'Hubballi Vidyanagar Branch',
    displayName: 'Axis Bank — Hubballi Branch',
    address: 'PB Road, Vidyanagar, Hubballi',
    area: 'Vidyanagar',
    city: 'Hubballi',
    hours: '09:30 AM – 04:30 PM',
    coords: { lat: 15.3647, lng: 75.124 },
    mapPos: { x: 28, y: 18 },
    isDemoBranch: false,
    desks: [
      {
        id: 'desk-axis-cs',
        queueServiceId: 'bank-axis-cs',
        name: 'Customer Service',
        description: 'Business accounts, MSME loan documentation, and everyday banking.',
        prefix: 'AX',
        avgServiceMinutes: 7,
        counters: ['Desk 1', 'Desk 2'],
        nextSequence: 102,
        reasonLabel: 'Visit reason (optional)',
        reasonPlaceholder: 'e.g., Current account KYC or cheque book request',
        documentChecklist: 'Bring your PAN Card, Aadhaar Card, and business registration proof for MSME inquiries.',
      },
    ],
  },
];

export function getBankBranchById(branchId?: string | null): BankBranchCatalogItem | undefined {
  if (!branchId) return undefined;
  return BANK_BRANCHES.find((b) => b.id === branchId);
}

export function findBankBranchByServiceId(serviceId?: string | null): {
  branch: BankBranchCatalogItem;
  desk: BankDeskCatalogItem;
} | null {
  if (!serviceId) return null;
  for (const branch of BANK_BRANCHES) {
    const desk = branch.desks.find((d) => d.queueServiceId === serviceId || d.id === serviceId);
    if (desk) return { branch, desk };
  }
  return null;
}
