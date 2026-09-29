type IconProps = { className?: string };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

export const BagIcon = ({ className = "size-6" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 7h12l1 13H5L6 7Z" />
    <path d="M9 7a3 3 0 0 1 6 0" />
  </svg>
);

export const SearchIcon = ({ className = "size-6" }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
);

export const MenuIcon = ({ className = "size-6" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const CloseIcon = ({ className = "size-6" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const MinusIcon = ({ className = "size-4" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M5 12h14" />
  </svg>
);

export const PlusIcon = ({ className = "size-4" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);


const brand = { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true };

export const InstagramIcon = ({ className = "size-5" }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="0.7" fill="currentColor" stroke="none" />
  </svg>
);

export const TikTokIcon = ({ className = "size-5" }: IconProps) => (
  <svg {...brand} className={className}>
    <path d="M16.6 3c.3 2.2 1.6 3.6 3.9 3.8v3a7 7 0 0 1-3.8-1.2v5.8c0 3.6-2.6 6.1-6 6.1a5.8 5.8 0 0 1-5.9-5.8c0-3.6 3.1-6.3 6.8-5.7v3.1c-1.9-.4-3.7.8-3.7 2.6 0 1.5 1.2 2.7 2.8 2.7 1.7 0 2.8-1.2 2.8-3.1V3h3.1Z" />
  </svg>
);

export const FacebookIcon = ({ className = "size-5" }: IconProps) => (
  <svg {...brand} className={className}>
    <path d="M13.5 21v-7.5H16l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3Z" />
  </svg>
);

export const WhatsAppIcon = ({ className = "size-5" }: IconProps) => (
  <svg {...brand} className={className}>
    <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Zm0 16.4c-1.4 0-2.8-.4-4-1.1l-.3-.2-2.7.7.7-2.6-.2-.3A7.4 7.4 0 1 1 12 19.4Zm4.1-5.5c-.2-.1-1.3-.7-1.5-.7-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6 6 0 0 1-3-2.6c-.2-.4.2-.4.7-1.2.1-.1 0-.3 0-.4l-.7-1.6c-.2-.4-.4-.4-.5-.4h-.4c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.1 1.6 2.5 4 3.5 1.5.6 2 .7 2.8.6.4-.1 1.3-.5 1.5-1.1.2-.5.2-1 .1-1.1l-.4-.2Z" />
  </svg>
);
