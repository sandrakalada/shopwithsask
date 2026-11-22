"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { addressLines, egp, waLink } from "@/lib/pdf";
import { Header } from "@/components/ui";
import { PhoneIcon, ReceiptIcon, WhatsAppIcon } from "@/components/Icons";
import { fmtDate, orderPhone, StatusPills } from "@/components/orderUi";

function CustomerView() {
  const id = useSearchParams().get("id") ?? "";
  const c = useLiveQuery(() => db.customers.get(id), [id]);
  const orders = useLiveQuery(async () => (await db.orders.where("customer_id").equals(id).toArray()).sort((a, b) => b.created_at.localeCompare(a.created_at)), [id], []);
  const invoices = useLiveQuery(() => db.invoices.where("customer_id").equals(id).toArray(), [id], []);

  if (c === undefined) return <Header title="" back />;
  if (!c) return (<><Header title="Customer" back /><p className="p-4 text-sm text-taupe">Not on this phone yet.</p></>);

  const phone = c.phone ?? (orders[0] ? orderPhone(orders[0]) : null);
  const first = (c.name ?? "").split(" ")[0];

  return (
    <>
      <Header title={c.name ?? "Customer"} back />
      <main className="space-y-4 p-4">
        <section className="card p-4">
          <p className="text-lg font-semibold">{c.name}</p>
          {phone && <p className="text-sm" dir="ltr">{phone}</p>}
          {c.email && <p className="text-sm text-taupe">{c.email}</p>}
          {c.address && <p className="mt-2 text-sm">{addressLines(c.address)}</p>}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat k="Orders" v={String(c.orders_count)} />
            <Stat k="Spent" v={egp(c.amount_spent)} />
            <Stat k="Since" v={c.created_at ? new Date(c.created_at).getFullYear().toString() : "-"} />
          </div>
          {phone && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a className="btn-light" href={waLink(phone, `Hi ${first}, this is Shop With Sask.`)} target="_blank" rel="noreferrer">
                <WhatsAppIcon className="h-5 w-5" /> WhatsApp
              </a>
              <a className="btn-light" href={`tel:${phone}`}>
                <PhoneIcon className="h-5 w-5" /> Call
              </a>
            </div>
          )}
          <Link href={`/invoice?new=1&customer=${c.id}`} className="btn-dark mt-2 w-full">
            <ReceiptIcon className="h-5 w-5" /> New invoice
          </Link>
          {c.note && <p className="mt-3 text-sm text-taupe">Note: {c.note}</p>}
        </section>

        <section>
          <h2 className="mb-2 font-semibold">Orders</h2>
          <ul className="card divide-y divide-line overflow-hidden">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/order?id=${o.id}`} className="block px-4 py-3 active:bg-sand">
                  <div className="flex justify-between">
                    <span className="font-semibold">{o.name}</span>
                    <span className="text-sm font-semibold">{egp(o.total)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <StatusPills o={o} />
                    <span className="text-xs text-taupe">{fmtDate(o.created_at)}</span>
                  </div>
                </Link>
              </li>
            ))}
            {orders.length === 0 && <li className="p-4 text-sm text-taupe">No orders on this phone.</li>}
          </ul>
        </section>

        {invoices.length > 0 && (
          <section>
            <h2 className="mb-2 font-semibold">Invoices</h2>
            <ul className="card divide-y divide-line overflow-hidden">
              {invoices.map((i) => (
                <li key={i.id}>
                  <Link href={`/invoice?id=${i.id}`} className="flex justify-between px-4 py-3 text-sm active:bg-sand">
                    <span className="font-semibold">{i.number}</span>
                    <span>{egp(i.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-sand px-2 py-2">
      <p className="text-[11px] text-taupe">{k}</p>
      <p className="truncate text-sm font-semibold">{v}</p>
    </div>
  );
}

export default function CustomerPage() {
  return (
    <Suspense>
      <CustomerView />
    </Suspense>
  );
}
