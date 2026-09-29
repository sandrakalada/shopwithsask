import { siteConfig } from "@/data/siteConfig";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "@/components/Icons";

const icons = { instagram: InstagramIcon, tiktok: TikTokIcon, facebook: FacebookIcon, whatsapp: WhatsAppIcon };

export function SocialLinks({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex gap-2 ${className}`}>
      {siteConfig.social.map((s) => {
        const Icon = icons[s.platform];
        return (
          <li key={s.platform}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${siteConfig.name} ${s.label}`}
              className="grid size-10 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white hover:text-espresso"
            >
              <Icon />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
