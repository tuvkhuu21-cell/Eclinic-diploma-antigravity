"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Search, Star } from "lucide-react";
import { DoctorFilterSidebar, type DoctorFilters } from "./DoctorFilterSidebar";
import { api } from "@/services/api";
import type { Doctor } from "@/components/doctors/DoctorCard";
import { DoctorProfileModal } from "@/components/doctors/DoctorProfileModal";

const initialFilters: DoctorFilters = {
  sort: null,
  hospital: "",
  gender: "Бүгд",
  visitTypes: [],
  specialty: "",
};

export function DoctorConsultationSearch() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<DoctorFilters>(initialFilters);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

  useEffect(() => {
    const specialty = new URLSearchParams(window.location.search).get("specialty");
    if (!specialty) return;
    const decodedSpecialty = specialty.trim();
    setFilters((current) => ({ ...current, specialty: decodedSpecialty }));
  }, []);

  useEffect(() => {
    const specialty = new URLSearchParams(window.location.search).get("specialty");
    const controller = new AbortController();
    setLoading(true);
    api.get("/doctors", { params: specialty ? { specialty, limit: 50 } : { limit: 50 }, signal: controller.signal })
      .then((response) => setDoctors(response.data.data as Doctor[]))
      .catch((error) => {
        if (error?.name !== "CanceledError" && error?.code !== "ERR_CANCELED") setDoctors([]);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const filteredDoctors = useMemo(() => {
    const normalizedQuery = normalize(query);
    const rows = doctors
      .map((doctor) => ({
        ...doctor,
        meta: {
          gender: doctor.gender || "",
          consultationTypes: consultationTypesForDoctor(doctor),
          consultations: doctor._count?.appointments || 0,
        },
      }))
      .filter((doctor) => {
        const doctorName = `${doctor.user.lastName || ""} ${doctor.user.firstName}`.trim();
        const hospitalName = doctor.hospital?.name || "";
        const matchesQuery = !normalizedQuery || normalize(`${doctorName} ${doctor.specialty} ${hospitalName}`).includes(normalizedQuery);
        const matchesHospital = !filters.hospital || hospitalName === filters.hospital;
        const matchesGender = filters.gender === "Бүгд" || doctor.meta.gender === filters.gender;
        const matchesVisitType = filters.visitTypes.length === 0 || (doctor.meta.consultationTypes ? filters.visitTypes.some((type) => doctor.meta.consultationTypes?.includes(type)) : true);
        const matchesSpecialty = !filters.specialty || specialtyMatches(doctor.specialty, filters.specialty);
        return matchesQuery && matchesHospital && matchesGender && matchesVisitType && matchesSpecialty;
      });

    if (!filters.sort) return rows;

    return [...rows].sort((a, b) => {
      const left = sortValue(a, filters.sort?.key);
      const right = sortValue(b, filters.sort?.key);
      return filters.sort?.direction === "asc" ? left - right : right - left;
    });
  }, [doctors, filters, query]);

  const hospitalOptions = useMemo(() => Array.from(new Set(doctors.map((doctor) => doctor.hospital?.name).filter(Boolean) as string[])), [doctors]);

  return (
    <section className="bg-slate-50 px-4 py-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[280px_1fr]">
        <DoctorFilterSidebar filters={filters} onChange={setFilters} hospitalOptions={hospitalOptions} />
        <main className="rounded-lg border border-sky-100 bg-white p-5 shadow-soft">
          <div className="flex items-center rounded-lg border border-sky-100 bg-white px-4 py-3">
            <Search size={19} className="text-medical" />
            <input className="ml-3 w-full text-sm outline-none" placeholder="Хайх эмчийн нэрийг оруулна уу..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className="mt-5 grid gap-3">
            {loading && Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-lg border border-sky-100 bg-slate-50" />
            ))}
            {!loading && filteredDoctors.map((doctor) => {
              const doctorName = `${doctor.user.lastName || ""} ${doctor.user.firstName}`.trim();
              return (
              <button key={doctor.id} type="button" className="flex flex-col gap-4 rounded-lg border border-sky-100 p-4 text-left transition hover:bg-cyanSoft md:flex-row md:items-center" onClick={() => setSelectedDoctor(doctor)}>
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-cyanSoft text-lg font-bold text-medical">{doctorName.slice(0, 2)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-navy">{doctorName}</h2>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${doctor.online ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      <span className={`h-2 w-2 rounded-full ${doctor.online ? "bg-emerald-500" : "bg-slate-400"}`} />
                      {doctor.online ? "Active" : "Offline"}
                    </span>
                    {doctor.verified && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700"><CheckCircle2 size={13} /> Verified</span>}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-medical">{doctor.specialty}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600">
                    <span>{doctor.experience} жил туршлага</span>
                    <span className="inline-flex items-center gap-1 text-amber-600"><Star size={15} fill="currentColor" />{doctor.rating}</span>
                    <span>{doctor.meta.consultations} зөвлөгөө</span>
                    <span className="font-bold text-medical">{doctor.fee.toLocaleString()}₮</span>
                  </div>
                </div>
              </button>
            );})}
            {!loading && filteredDoctors.length === 0 && (
              <div className="grid min-h-56 place-items-center rounded-lg border border-dashed border-sky-100 bg-cyanSoft text-center">
                <p className="text-lg font-bold text-navy">{doctors.length === 0 ? "Одоогоор эмч бүртгэлгүй байна." : "Илэрц олдсонгүй"}</p>
              </div>
            )}
          </div>
        </main>
      </div>
      <DoctorProfileModal doctor={selectedDoctor} onClose={() => setSelectedDoctor(null)} />
    </section>
  );
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[,\s]/g, "");
}

function sortValue(doctor: Doctor & { meta: { consultations: number } }, key?: "experience" | "rating" | "consultations") {
  if (key === "experience") return doctor.experience;
  if (key === "rating") return doctor.rating;
  if (key === "consultations") return doctor.meta.consultations;
  return 0;
}

function specialtyMatches(doctorSpecialty: string, selectedSpecialty: string) {
  const doctorValue = normalize(doctorSpecialty);
  const selectedValue = normalize(selectedSpecialty);
  const aliases: Record<string, string[]> = {
    [normalize("Дотор")]: [normalize("Дотор"), normalize("Дотрын")],
    [normalize("Арьс, харшил")]: [normalize("Арьс"), normalize("Харшил")],
    [normalize("Зүрх судас")]: [normalize("Зүрх судас")],
    [normalize("Мэдрэл")]: [normalize("Мэдрэл"), normalize("Мэдрэлийн")],
    [normalize("Хүүхэд")]: [normalize("Хүүхэд"), normalize("Хүүхдийн")],
    [normalize("Нүд")]: [normalize("Нүд")],
  };
  const needles = aliases[selectedValue] || [selectedValue];
  return needles.some((needle) => doctorValue.includes(needle));
}

function consultationTypesForDoctor(doctor: Doctor) {
  const types: Array<"Онлайн" | "Биечлэн"> = [];
  if (doctor.supportsOnline ?? doctor.online) types.push("Онлайн");
  if (doctor.supportsInPerson) types.push("Биечлэн");
  return types.length > 0 ? types : ["Онлайн"];
}
