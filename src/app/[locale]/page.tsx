import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, otherLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  return (
    <>
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <span className="text-lg font-extrabold">{dict.brand.name}</span>
        <Link
          href={`/${otherLocale(locale)}`}
          className="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-semibold hover:bg-stone-100"
        >
          {dict.switchLanguage}
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-16 text-center">
        <span className="rounded-full bg-brand-accent-light px-4 py-1 text-sm font-bold text-brand-accent">
          {dict.home.badge}
        </span>
        <h1 className="max-w-2xl text-4xl font-extrabold sm:text-5xl">{dict.home.title}</h1>
        <p className="max-w-xl text-lg text-stone-600">{dict.home.subtitle}</p>
      </main>

      <footer className="px-4 py-6 text-center text-sm text-stone-500">
        © {new Date().getFullYear()} {dict.brand.name}. {dict.footer.rights}
      </footer>
    </>
  );
}
