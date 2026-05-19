"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { Building2, Search, Stethoscope } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { api } from "@/services/api";

type DoctorResult = {
  id: string;
  specialty?: string | null;
  experience?: number | null;
  hospital?: { name?: string | null } | null;
  user?: { firstName?: string | null; lastName?: string | null };
};

type HospitalResult = {
  id: string;
  name: string;
  type?: string | null;
  district?: string | null;
  address?: string | null;
  phone?: string | null;
};

export function SearchSection() {
  const [doctorQuery, setDoctorQuery] = useState("");
  const [hospitalQuery, setHospitalQuery] = useState("");
  const [doctorResults, setDoctorResults] = useState<DoctorResult[]>([]);
  const [hospitalResults, setHospitalResults] = useState<HospitalResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  async function runSearch() {
    setSearched(true);
    setLoading(true);
    const doctorText = doctorQuery.trim();
    const hospitalText = hospitalQuery.trim();
    try {
      const [doctorResponse, hospitalResponse] = await Promise.all([
        api.get("/doctors", { params: doctorText ? { q: doctorText } : undefined }).catch(() => ({ data: { data: [] } })),
        api.get("/hospitals", { params: hospitalText ? { q: hospitalText } : undefined }).catch(() => ({ data: { data: [] } })),
      ]);
      const doctors = (doctorResponse.data.data || []) as DoctorResult[];
      const hospitals = (hospitalResponse.data.data || []) as HospitalResult[];
      setDoctorResults(sortBySimilarity(doctors, doctorText, (doctor) => `${doctor.user?.lastName || ""} ${doctor.user?.firstName || ""} ${doctor.specialty || ""} ${doctor.hospital?.name || ""}`).slice(0, 12));
      setHospitalResults(sortBySimilarity(hospitals, hospitalText, (hospital) => `${hospital.name} ${hospital.type || ""} ${hospital.district || ""} ${hospital.address || ""}`).slice(0, 12));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative z-20 mx-auto -mt-7 max-w-7xl px-4">
      <Card className="relative grid gap-4 rounded-3xl p-5 md:grid-cols-[1fr_1fr_auto]">
        <label className="relative">
          <Stethoscope className="absolute left-3 top-3 text-medical" size={18} />
          <Input className="pl-10" placeholder="Эмчийн нэр, мэргэжлээр хайх" value={doctorQuery} onChange={(event) => setDoctorQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void runSearch(); }} />
        </label>
        <label className="relative">
          <Building2 className="absolute left-3 top-3 text-medical" size={18} />
          <Input className="pl-10" placeholder="Эмнэлэг, дүүргээр хайх" value={hospitalQuery} onChange={(event) => setHospitalQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void runSearch(); }} />
        </label>
        <Button className="h-11" onClick={() => void runSearch()}><Search size={18} className="mr-2" />Хайх</Button>

        {searched && (
          <div className="absolute left-4 right-4 top-[calc(100%+10px)] z-40 max-h-[420px] overflow-y-auto rounded-3xl border border-emerald-100 bg-white p-5 shadow-[0_24px_70px_rgba(19,80,68,0.18)] [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-extrabold text-navy">Хайлтын илэрц</h2>
              <span className="text-xs font-bold text-slate-400">{loading ? "Хайж байна..." : `${doctorResults.length + hospitalResults.length} илэрц`}</span>
            </div>
            {!loading && doctorResults.length + hospitalResults.length === 0 && (
              <p className="rounded-2xl bg-cyanSoft p-4 text-sm font-semibold text-medical">Илэрц олдсонгүй. Богино нэр эсвэл ижил төстэй үгээр дахин хайна уу.</p>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <ResultColumn title="Эмч нар">
                {doctorResults.map((doctor) => {
                  const name = `${doctor.user?.lastName || ""} ${doctor.user?.firstName || ""}`.trim() || "Эмч";
                  return (
                    <Link key={doctor.id} href={`/doctors/${doctor.id}`} className="block rounded-2xl border border-emerald-100 p-3 transition hover:bg-cyanSoft">
                      <p className="font-extrabold text-navy">{name}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-600">{doctor.specialty || "Мэргэжил тодорхойгүй"} · {doctor.experience || 0} жил</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{doctor.hospital?.name || "Эмнэлэг бүртгээгүй"}</p>
                    </Link>
                  );
                })}
              </ResultColumn>
              <ResultColumn title="Эмнэлгүүд">
                {hospitalResults.map((hospital) => (
                  <Link key={hospital.id} href={`/hospitals/${hospital.id}`} className="block rounded-2xl border border-emerald-100 p-3 transition hover:bg-cyanSoft">
                    <p className="font-extrabold text-navy">{hospital.name}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">{hospital.type || "Эмнэлэг"} · {hospital.district || "Байршил тодорхойгүй"}</p>
                    <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">{hospital.address || hospital.phone || "Дэлгэрэнгүй харах"}</p>
                  </Link>
                ))}
              </ResultColumn>
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}

function ResultColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-medical">{title}</h3>
      <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">{children}</div>
    </section>
  );
}

function sortBySimilarity<T>(items: T[], query: string, textOf: (item: T) => string) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return items;
  return [...items]
    .map((item) => ({ item, score: score(normalizedQuery, normalize(textOf(item))) }))
    .filter(({ score }) => score > 0)
    .sort((first, second) => second.score - first.score)
    .map(({ item }) => item);
}

function score(query: string, text: string) {
  if (text.includes(query)) return 100 - Math.min(text.indexOf(query), 40);
  const words = query.split(/\s+/).filter(Boolean);
  const matches = words.filter((word) => text.includes(word)).length;
  if (matches) return 50 + matches;
  if (query.length < 3) return 0;
  return text.split(/\s+/).some((word) => word.startsWith(query.slice(0, 3))) ? 25 : 0;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
