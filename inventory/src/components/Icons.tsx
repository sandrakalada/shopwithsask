type P = { className?: string };
const base = (path: React.ReactNode, className = "h-6 w-6") => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    {path}
  </svg>
);

export const HomeIcon = ({ className }: P) => base(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>, className);
export const ScanIcon = ({ className }: P) =>
  base(<><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M7 12h10" /></>, className);
export const BoxIcon = ({ className }: P) =>
  base(<><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="m3 8 9 5 9-5M12 13v8" /></>, className);
export const ClockIcon = ({ className }: P) => base(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, className);
export const GearIcon = ({ className }: P) =>
  base(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>, className);
export const PlusIcon = ({ className }: P) => base(<path d="M12 5v14M5 12h14" />, className);
export const MinusIcon = ({ className }: P) => base(<path d="M5 12h14" />, className);
export const SearchIcon = ({ className }: P) => base(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>, className);
export const BackIcon = ({ className }: P) => base(<path d="m15 18-6-6 6-6" />, className);
export const PrintIcon = ({ className }: P) =>
  base(<><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M6 14h12v7H6z" /></>, className);
export const SyncIcon = ({ className }: P) =>
  base(<><path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3" /><path d="M4 4v4h4M20 20v-4h-4" /></>, className);
export const FlashIcon = ({ className }: P) => base(<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />, className);
