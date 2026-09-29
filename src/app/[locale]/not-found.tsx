import Link from "next/link";

// Rendered inside the locale layout; the locale isn't available here, so the copy is bilingual.
export default function LocaleNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-6xl font-bold text-caramel">404</p>
      <h1 className="mt-4 text-2xl font-bold">Page not found · الصفحة مش موجودة</h1>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/" className="rounded-full bg-espresso px-6 py-3 font-bold text-white hover:bg-ink">Home</Link>
        <Link href="/ar" className="rounded-full border border-espresso px-6 py-3 font-bold hover:bg-sand">الرئيسية</Link>
      </div>
    </div>
  );
}
