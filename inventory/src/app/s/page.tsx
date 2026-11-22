"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { findByCode } from "@/lib/stock";

/** Opened from a sticker QR of an item that is not on the website: jumps to the item. */
function Resolve() {
  const code = useSearchParams().get("c") ?? "";
  const router = useRouter();
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    findByCode(code).then((v) => (v ? router.replace(`/item?id=${v.product_id}`) : setMissing(true)));
  }, [code, router]);
  return <p className="p-6 text-center text-sm text-taupe">{missing ? `No item with code ${code} on this phone.` : "Opening item"}</p>;
}

export default function ResolvePage() {
  return (
    <Suspense>
      <Resolve />
    </Suspense>
  );
}
