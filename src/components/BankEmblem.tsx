import React from 'react';

export type BankBrandId =
  | 'karnataka-bank'
  | 'canara-bank'
  | 'sbi'
  | 'hdfc'
  | 'icici'
  | 'bob'
  | 'union-bank'
  | 'axis';

interface BankEmblemProps {
  brand?: BankBrandId;
  className?: string;
}

export function BankEmblem({ brand = 'karnataka-bank', className = 'h-9 w-9' }: BankEmblemProps) {
  switch (brand) {
    case 'karnataka-bank':
      return (
        <div
          className={`flex shrink-0 items-center justify-center rounded-xl bg-[#4C1D95] text-white shadow-2xs ${className}`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
            <path d="M4 18L12 5L20 18H4Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
            <circle cx="12" cy="14" r="2.2" fill="currentColor" />
          </svg>
        </div>
      );
    case 'canara-bank':
      return (
        <div
          className={`flex shrink-0 items-center justify-center rounded-xl bg-[#0284C7] text-white shadow-2xs ${className}`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
            <path d="M6 17L12 5L18 17H6Z" fill="#FACC15" />
            <path d="M9 17L12 10.5L15 17H9Z" fill="#0284C7" />
          </svg>
        </div>
      );
    case 'sbi':
      return (
        <div
          className={`flex shrink-0 items-center justify-center rounded-xl bg-[#1D4ED8] text-white shadow-2xs ${className}`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
            <circle cx="12" cy="11" r="6.5" stroke="currentColor" strokeWidth="2.4" />
            <circle cx="12" cy="11" r="2" fill="currentColor" />
            <path d="M12 13V19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </div>
      );
    case 'hdfc':
      return (
        <div
          className={`flex shrink-0 items-center justify-center rounded-xl bg-[#DC2626] text-white shadow-2xs ${className}`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
            <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2.2" />
            <path d="M12 4V20M4 12H20" stroke="currentColor" strokeWidth="1.8" />
            <rect x="9" y="9" width="6" height="6" fill="#1E3A8A" />
          </svg>
        </div>
      );
    case 'icici':
      return (
        <div
          className={`flex shrink-0 items-center justify-center rounded-xl bg-[#C2410C] text-white shadow-2xs ${className}`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
            <path
              d="M7 18V8.5C7 6.8 8.5 5.5 10.2 5.5H13.8C15.5 5.5 17 6.8 17 8.5V18"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
            />
            <circle cx="12" cy="10.5" r="2.2" fill="#FDE047" />
          </svg>
        </div>
      );
    case 'bob':
      return (
        <div
          className={`flex shrink-0 items-center justify-center rounded-xl bg-[#EA580C] text-white shadow-2xs ${className}`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
            <path d="M5 17C5 11.5 9 7 15.5 7H19" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
            <path d="M8 17C8 13.5 10.8 10.5 15.5 10.5H19" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
          </svg>
        </div>
      );
    case 'union-bank':
      return (
        <div
          className={`flex shrink-0 items-center justify-center rounded-xl bg-[#B91C1C] text-white shadow-2xs ${className}`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
            <path d="M7 6V13.5C7 16.5 9.2 18.5 12 18.5C14.8 18.5 17 16.5 17 13.5V6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M10.5 6V13C10.5 14.2 11.2 15 12 15C12.8 15 13.5 14.2 13.5 13V6" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      );
    case 'axis':
      return (
        <div
          className={`flex shrink-0 items-center justify-center rounded-xl bg-[#881337] text-white shadow-2xs ${className}`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
            <path d="M5 18L12 5L19 18H15L12 12L9 18H5Z" fill="currentColor" />
          </svg>
        </div>
      );
  }
}
