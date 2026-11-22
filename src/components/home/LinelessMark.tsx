interface LinelessMarkProps {
  className?: string;
  size?: number;
}

/**
 * Geometric interlocking queue-square emblem matching the LINELESS brand mark.
 */
export function LinelessMark({ className = '', size = 24 }: LinelessMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* Top-left bracket */}
      <path
        d="M5 14V6.5C5 5.67157 5.67157 5 6.5 5H17V9.5H9.5V14H5Z"
        fill="currentColor"
      />
      {/* Bottom-right interlocking bracket */}
      <path
        d="M23 14V21.5C23 22.3284 22.3284 23 21.5 23H11V18.5H18.5V14H23Z"
        fill="currentColor"
        opacity="0.72"
      />
      {/* Center order square */}
      <rect x="11.75" y="11.75" width="4.5" height="4.5" rx="1" fill="currentColor" opacity="0.92" />
    </svg>
  );
}
