"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, FlaskConical, MapPin, Phone, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart.store";
import { DbHealthPackage, formatCurrency, packagePaymentUrl } from "./HealthPackagePage";

export function HealthPackageDetailPage({ packageId }: { packageId: string }) {
  const router = useRouter();
  const [item, setItem] = useState<DbHealthPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const { hydrate, addItem, hasItem } = useCartStore();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [showAll, setShowAll] = useState(false);
  const inCart = item ? hasItem(item.id) : false;
  const visibleTests = item ? (showAll ? item.tests : item.tests.slice(0, 5)) : [];

  useEffect(() => {
    hydrate();
    fetch(`/api/health-packages/${packageId}`)
      .then((response) => response.json())
      .then((response) => setItem(response.data as DbHealthPackage))
      .catch(() => setItem(null))
      .finally(() => setLoading(false));
  }, [hydrate, packageId]);

  function addToCart() {
    if (!item) return;
    addItem({ id: item.id, name: item.name, price: `${formatCurrency(item.price)}₮`, description: item.description });
  }

  if (loading) return <section className="bg-slate-50 px-4 py-8"><div className="mx-auto max-w-7xl rounded-2xl border border-sky-100 bg-white p-6 text-sm font-bold text-slate-500 shadow-soft">Багц ачаалж байна...</div></section>;
  if (!item) return <section className="bg-slate-50 px-4 py-8"><div className="mx-auto max-w-7xl rounded-2xl border border-dashed border-sky-100 bg-white p-10 text-center text-lg font-bold text-navy shadow-soft">Багц шинжилгээ олдсонгүй.</div></section>;

  return (
    <section className="bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-sky-100 bg-white p-6 shadow-soft">
            <div className="flex flex-col gap-6 md:flex-row">
              <div className="grid h-36 w-36 shrink-0 place-items-center rounded-2xl bg-cyanSoft text-medical"><FlaskConical size={64} /></div>
              <div className="min-w-0 flex-1">
                <h1 className="text-3xl font-bold text-navy">{item.name}</h1>
                <p className="mt-2 text-slate-600">{item.description}</p>
                <div className="mt-5 flex flex-wrap items-end gap-3">
                  {item.oldPrice > 0 && <span className="text-sm text-slate-400 line-through">{formatCurrency(item.oldPrice)}₮</span>}
                  {item.discount && <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-bold text-rose-600">{item.discount}</span>}
                  <span className="text-2xl font-bold text-medical">{formatCurrency(item.price)}₮</span>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button onClick={() => router.push(packagePaymentUrl(item))}>Захиалах</Button>
                  <Button variant="outline" onClick={addToCart}><ShoppingCart size={16} className="mr-2" />{inCart ? "Сагслагдсан" : "Сагслах"}</Button>
                </div>
              </div>
            </div>
          </div>
          <LabInfoCard item={item} />
        </div>

        <section className="mt-6 rounded-2xl border border-sky-100 bg-white p-6 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-navy">Багцад хамаарах шинжилгээнүүд</h2>
            <button type="button" className="text-sm font-bold text-medical hover:text-sky-600" onClick={() => { setShowAll((value) => !value); setOpenIndex(null); }}>
              {showAll ? "Хураах" : `Бүгдийг харах (${item.tests.length})`}
            </button>
          </div>
          <div className="mt-5 grid gap-3">
            {visibleTests.map((test, index) => {
              const isOpen = openIndex === index;
              return (
                <article key={`${test.title}-${index}`} className="overflow-hidden rounded-xl border border-sky-100">
                  <button type="button" className="flex w-full items-center justify-between px-4 py-4 text-left font-bold text-navy hover:bg-cyanSoft" onClick={() => setOpenIndex(isOpen ? null : index)}>
                    {test.title}
                    <ChevronDown size={18} className={cn("text-medical transition", isOpen && "rotate-180")} />
                  </button>
                  {isOpen && (
                    <div className="border-t border-sky-100 p-4 text-sm leading-6 text-slate-600">
                      <p className="font-bold text-medical">Tests:</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {test.tests.map((row) => <li key={row}>{row}</li>)}
                      </ul>
                      <p className="mt-4 font-bold text-medical">Ач холбогдол:</p>
                      <p className="mt-1">{test.importance}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}

function LabInfoCard({ item }: { item: DbHealthPackage }) {
  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-navy">Шинжилгээ өгөх лаборатори</h2>
        <div className="mt-5 grid gap-4 text-sm text-slate-600">
          <p className="flex gap-3"><Building2 className="shrink-0 text-medical" size={18} /><span><b>Лаборатори:</b> {item.hospital.name}</span></p>
          <p><b>Цаг:</b> {item.labHours}</p>
          <p className="flex gap-3"><MapPin className="shrink-0 text-medical" size={18} /><span><b>Хаяг:</b> {item.hospital.address}</span></p>
          <p className="flex gap-3"><Phone className="shrink-0 text-medical" size={18} /><span><b>Утас:</b> {item.hospital.phone || "Утас бүртгээгүй"}</span></p>
        </div>
      </div>
    </aside>
  );
}
