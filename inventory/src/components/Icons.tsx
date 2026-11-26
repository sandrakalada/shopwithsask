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
export const ReceiptIcon = ({ className }: P) =>
  base(<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6M9 16h3" /></>, className);
export const UsersIcon = ({ className }: P) =>
  base(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" /></>, className);
export const WhatsAppIcon = ({ className }: P) =>
  base(<><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19.1L4 20Z" /><path d="M9.5 9.5c.3 2 2 3.8 4 4.2l1-1.1 1.7.8c-.2 1-1 1.7-2 1.6-3-.3-5.5-2.8-5.8-5.8 0-1 .6-1.8 1.6-2l.8 1.7-1.3.6Z" /></>, className);
export const PhoneIcon = ({ className }: P) =>
  base(<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />, className);
export const TruckIcon = ({ className }: P) =>
  base(<><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>, className);
export const ChartIcon = ({ className }: P) => base(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>, className);
export const WalletIcon = ({ className }: P) =>
  base(<><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 14.5h2" /></>, className);
export const CameraIcon = ({ className }: P) =>
  base(<><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>, className);
export const DocIcon = ({ className }: P) => base(<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5" />, className);
