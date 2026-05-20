"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, ChevronDown, FlaskConical, Info, MapPin, Phone, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart.store";

export type DbHealthPackage = {
  id: string;
  name: string;
  description: string;
  summary: string;
  oldPrice: number;
  price: number;
  discount: string;
  icon: string;
  labHours: string;
  tests: Array<{ title: string; tests: string[]; importance: string }>;
  hospital: { id: string; name: string; type: string; address: string; district: string; phone?: string | null };
};

type SortDirection = "desc" | "asc" | null;

export function HealthPackagePage() {
  const router = useRouter();
  const [packages, setPackages] = useState<DbHealthPackage[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const { hydrate, addItem, hasItem } = useCartStore();
  const selectedPackage = packages.find((item) => item.id === selectedId) || packages[0];
  const sortedPackages = useMemo(() => {
    if (!sortDirection) return packages;
    return [...packages].sort((a, b) => sortDirection === "asc" ? a.price - b.price : b.price - a.price);
  }, [packages, sortDirection]);

  useEffect(() => {
    hydrate();
    fetch("/api/health-packages")
      .then((response) => response.json())
      .then((response) => {
        const rows = (response.data || []) as DbHealthPackage[];
        setPackages(rows);
        setSelectedId(rows[0]?.id || "");
      })
      .catch(() => setPackages([]))
      .finally(() => setLoading(false));
  }, [hydrate]);

  return (
    <section className="bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold text-navy">Урьдчилан сэргийлэх багц шинжилгээнүүд</h1>
          <div className="relative">
            <button type="button" className="inline-flex h-10 items-center gap-2 rounded-lg border border-sky-100 bg-white px-4 text-sm font-bold text-medical shadow-sm hover:bg-cyanSoft" onClick={() => setSortOpen((open) => !open)}>
              Эрэмбэлэх
              <ChevronDown size={16} />
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-12 z-20 w-56 rounded-xl border border-sky-100 bg-white p-3 text-sm font-semibold text-medical shadow-soft">
                <button type="button" className="block w-full rounded-lg px-3 py-2 text-left hover:bg-cyanSoft" onClick={() => { setSortDirection("desc"); setSortOpen(false); }}>Үнэ ихээс бага</button>
                <button type="button" className="block w-full rounded-lg px-3 py-2 text-left hover:bg-cyanSoft" onClick={() => { setSortDirection("asc"); setSortOpen(false); }}>Үнэ багаас их</button>
              </div>
            )}
          </div>
        </div>
        {loading ? (
          <div className="mt-6 rounded-2xl border border-sky-100 bg-white p-6 text-sm font-bold text-slate-500 shadow-soft">Багц шинжилгээ ачаалж байна...</div>
        ) : !packages.length ? (
          <div className="mt-6 rounded-2xl border border-dashed border-sky-100 bg-white p-10 text-center shadow-soft">
            <FlaskConical className="mx-auto text-medical" size={42} />
            <p className="mt-4 text-xl font-bold text-navy">Одоогоор эмнэлгээс оруулсан багц шинжилгээ алга.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="grid gap-4">
              {sortedPackages.map((item) => {
                const selected = item.id === selectedId;
                const inCart = hasItem(item.id);
                return (
                  <article key={item.id} className={cn("rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-soft", selected ? "border-medical ring-4 ring-sky-100" : "border-sky-100")} onClick={() => setSelectedId(item.id)}>
                    <div className="flex flex-col gap-4 md:flex-row md:items-center">
                      <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-cyanSoft text-medical"><FlaskConical size={44} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-bold text-navy">{item.name}</h2>
                          {selected && <span className="inline-flex items-center gap-1 rounded-full bg-cyanSoft px-2 py-1 text-xs font-bold text-medical"><CheckCircle2 size={13} /> Сонгосон</span>}
                        </div>
                        <p className="mt-1 text-sm font-bold text-medical">{item.hospital.name}</p>
                        <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                        <div className="mt-3 flex flex-wrap items-end gap-3">
                          {item.oldPrice > 0 && <span className="text-sm text-slate-400 line-through">{formatCurrency(item.oldPrice)}₮</span>}
                          {item.discount && <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-bold text-rose-600">{item.discount}</span>}
                          <span className="text-xl font-bold text-medical">{formatCurrency(item.price)}₮</span>
                          <button type="button" className="group relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-100 bg-white text-medical shadow-sm hover:bg-cyanSoft" onClick={(event) => { event.stopPropagation(); router.push(`/patient/home/health-checkup/${item.id}`); }} aria-label={`${item.name} дэлгэрэнгүй`}>
                            <Info size={16} />
                            <span className="pointer-events-none absolute bottom-10 left-1/2 z-20 hidden w-72 -translate-x-1/2 rounded-xl border border-sky-100 bg-white p-3 text-left text-xs font-semibold leading-5 text-slate-600 shadow-soft group-hover:block">
                              <b className="block text-medical">Дэлгэрэнгүй</b>
                              {item.summary}
                            </span>
                          </button>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button className="h-10 px-4" onClick={(event) => { event.stopPropagation(); router.push(packagePaymentUrl(item)); }}>Захиалах</Button>
                        <Button variant="outline" className="h-10 px-4" onClick={(event) => { event.stopPropagation(); setSelectedId(item.id); addItem({ id: item.id, name: item.name, price: `${formatCurrency(item.price)}₮`, description: item.description }); }}>
                          <ShoppingCart size={16} className="mr-2" />
                          {inCart ? "Сагслагдсан" : "Сагслах"}
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {selectedPackage && <LabInfoCard item={selectedPackage} />}
          </div>
        )}
      </div>
    </section>
  );
}

export function packagePaymentUrl(item: DbHealthPackage) {
  const params = new URLSearchParams({
    type: "PACKAGE_ORDER",
    packageId: item.id,
    packageName: item.name,
    hospitalId: item.hospital.id,
    labName: item.hospital.name,
    price: String(item.price),
    scheduledAt: new Date().toISOString(),
  });
  return `/patient/home/appointment/payment?${params.toString()}`;
}

export function formatCurrency(value: number) {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
