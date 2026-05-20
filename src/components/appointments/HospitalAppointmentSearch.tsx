"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { Building2, CalendarDays, Check, ChevronDown, Clock, MapPin, Navigation, Phone, Search, X } from "lucide-react";
import { AppointmentFilterSidebar } from "./AppointmentFilterSidebar";
import { DoctorProfileModal } from "@/components/doctors/DoctorProfileModal";
import type { Doctor } from "@/components/doctors/DoctorCard";
import { hospitals } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";

type SearchMode = "hospital" | "state" | "laboratory" | "package";
type HospitalRow = {
  id: string;
  name: string;
  type: string;
  district: string;
  phone: string;
  address?: string;
  rating?: number;
  departments?: number;
  doctorCount?: number;
  appointmentCount?: number;
  doctors?: Array<{ id: string; specialty: string; supportsInPerson?: boolean; user: { firstName: string; lastName?: string } }>;
  lat?: number;
  lng?: number;
  openNow?: boolean;
  hours?: string;
};

const pageSize = 6;
const locations = ["Бүгд", "Улаанбаатар", "Архангай", "Баян-Өлгий", "Баянхонгор", "Булган", "Говь-Алтай", "Говьсүмбэр", "Дархан-Уул", "Дорноговь", "Дорнод", "Дундговь", "Завхан", "Орхон", "Өвөрхангай", "Өмнөговь", "Сүхбаатар", "Сэлэнгэ", "Төв", "Увс", "Ховд", "Хөвсгөл", "Хэнтий"];
const directions = ["Бүгд", "Харшил", "Арьс", "Бөөр", "Дотоод шүүрэл", "Хоол боловсруулах эрхтэн", "Зүрх судас", "Мэдрэл", "Нүд", "Сэргээн засах", "Сэтгэц", "Уушги", "Үе мөч", "Нярай", "Хүүхэд", "Чих, хамар, хоолой", "Шүд", "Эрэгтэйчүүд", "Эх барих, эмэгтэйчүүд", "Халдварт өвчин / Ковид", "Өсвөр үе", "Гэмтэл", "Сэтгэл зүйч", "Дотор", "Мэс засал"];
const ubDistricts = ["Сүхбаатар", "Баянзүрх", "Хан-Уул", "Баянгол", "Чингэлтэй", "Сонгинохайрхан", "Налайх", "Багануур", "Багахангай"];
const schedule = [
  ["Даваа", "08:30 - 17:30"],
  ["Мягмар", "08:30 - 17:30"],
  ["Лхагва", "08:30 - 17:30"],
  ["Пүрэв", "08:30 - 17:30"],
  ["Баасан", "08:30 - 17:30"],
  ["Бямба", "09:00 - 14:00"],
  ["Ням", "Амрана"],
];

const laboratoryRows: HospitalRow[] = [
  { id: "lab-1", name: "MediLab Diagnostic Center", type: "Лаборатори", district: "Сүхбаатар", phone: "1800-3030", openNow: true, hours: "08:30 - 17:30" },
  { id: "lab-2", name: "Нарны шинжилгээний төв", type: "Лаборатори", district: "Баянзүрх", phone: "7010-4040", openNow: true, hours: "08:00 - 18:00" },
  { id: "lab-3", name: "City Lab Mongolia", type: "Лаборатори", district: "Хан-Уул", phone: "7711-5050", openNow: false, hours: "09:00 - 17:00" },
];

const packageRows: HospitalRow[] = [
  { id: "package-1", name: "Ерөнхий эрүүл мэндийн багц", type: "Эрүүл мэндийн багц", district: "Сүхбаатар", phone: "1800-2026", openNow: true, hours: "08:30 - 17:30" },
  { id: "package-2", name: "Зүрх судасны багц", type: "Эрүүл мэндийн багц", district: "Баянзүрх", phone: "1800-2026", openNow: true, hours: "08:30 - 17:30" },
  { id: "package-3", name: "Дархлаа, витамин багц", type: "Эрүүл мэндийн багц", district: "Хан-Уул", phone: "1800-2026", openNow: false, hours: "09:00 - 16:00" },
];

export function HospitalAppointmentSearch({ mode = "hospital" }: { mode?: SearchMode }) {
  const [openNow, setOpenNow] = useState(false);
  const [location, setLocation] = useState("Бүгд");
  const [selectedDirections, setSelectedDirections] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [selectedHospital, setSelectedHospital] = useState<HospitalRow | null>(null);
  const [modalHospital, setModalHospital] = useState<HospitalRow | null>(null);
  const [dbHospitals, setDbHospitals] = useState<HospitalRow[]>([]);
  const rows = useMemo(() => {
    const fallback = getRows(mode);
    if (!dbHospitals.length) return fallback;
    if (mode === "laboratory") return [...dbHospitals.filter((row) => normalize(`${row.type} ${row.name}`).includes(normalize("лаборатори"))), ...laboratoryRows];
    if (mode === "package") return [...dbHospitals, ...packageRows];
    if (mode === "state") return fallback;
    return [...dbHospitals, ...fallback.filter((row) => !dbHospitals.some((db) => normalize(db.name) === normalize(row.name)))];
  }, [dbHospitals, mode]);
  const active = mode === "laboratory" ? "laboratory" : mode === "package" ? "package" : "hospital";
  const mapTitle = { hospital: "Хувийн эмнэлгийн байршил", state: "Улсын эмнэлгийн байршил", laboratory: "Лабораторийн байршил", package: "Эрүүл мэндийн багцын байршил" }[mode];

  const filteredRows = useMemo(() => {
    if (mode !== "hospital" && mode !== "state") return rows;
    return rows.filter((hospital) => {
      const matchesOpen = !openNow || hospital.openNow !== false;
      const matchesLocation = location === "Бүгд" || inferLocation(hospital) === location;
      const matchesDirection = selectedDirections.length === 0 || selectedDirections.some((direction) => hospitalDirections(hospital).includes(direction));
      return matchesOpen && matchesLocation && matchesDirection;
    });
  }, [location, mode, openNow, rows, selectedDirections]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pagedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const markerHospital = selectedHospital && filteredRows.some((row) => row.id === selectedHospital.id) ? selectedHospital : pagedRows[0] || null;

  useEffect(() => {
    setPage(1);
    setSelectedHospital(null);
  }, [location, openNow, selectedDirections]);

  useEffect(() => {
    api.get("/hospitals")
      .then((response) => {
        const hospitals = (response.data.data || []) as Array<{
          id: string;
          name: string;
          type: string;
          district: string;
          phone?: string | null;
          address?: string;
          latitude: number;
          longitude: number;
          rating: number;
          departments?: unknown[];
          doctors?: HospitalRow["doctors"];
          _count?: { departments?: number; doctors?: number; appointments?: number };
        }>;
        setDbHospitals(hospitals.map((hospital) => ({
          id: hospital.id,
          name: hospital.name,
          type: hospital.type,
          district: hospital.district,
          phone: hospital.phone || "Утас бүртгээгүй",
          address: hospital.address,
          rating: hospital.rating,
          departments: hospital._count?.departments || hospital.departments?.length || 0,
          doctorCount: hospital._count?.doctors || hospital.doctors?.length || 0,
          appointmentCount: hospital._count?.appointments || 0,
          doctors: hospital.doctors || [],
          lat: hospital.latitude,
          lng: hospital.longitude,
          openNow: true,
          hours: "08:30 - 17:30",
        })));
      })
      .catch(() => setDbHospitals([]));
  }, []);

  return (
    <section className="bg-slate-50 px-4 py-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[280px_1fr]">
        <AppointmentFilterSidebar active={active}>
          {mode === "hospital" || mode === "state" ? <HospitalFilterControls openNow={openNow} onOpenNowChange={setOpenNow} location={location} onLocationChange={setLocation} selectedDirections={selectedDirections} onDirectionsChange={setSelectedDirections} /> : undefined}
        </AppointmentFilterSidebar>
        <main className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="rounded-lg border border-sky-100 bg-white p-5 shadow-soft">
            <div className="grid gap-3">
              {pagedRows.map((hospital) => (
                <button key={hospital.id} type="button" className="flex gap-4 rounded-lg border border-sky-100 p-4 text-left transition hover:-translate-y-0.5 hover:border-medical hover:bg-cyanSoft hover:shadow-soft" onClick={() => { setSelectedHospital(hospital); setModalHospital(hospital); }}>
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-cyanSoft text-medical"><Building2 size={30} /></div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-navy">{hospital.name}</h2>
                    <p className="mt-1 text-sm font-semibold text-medical">{hospital.type}</p>
                    <p className="mt-2 flex items-center gap-2 text-sm text-slate-600"><MapPin size={15} />{hospital.district} дүүрэг</p>
                    <p className="mt-1 flex items-center gap-2 text-sm text-slate-600"><Phone size={15} />{hospital.phone}</p>
                    {(mode === "hospital" || mode === "state") && <p className="mt-2 text-xs font-semibold text-slate-500">{hospitalDirections(hospital).slice(0, 3).join(" · ")}</p>}
                    {hospital.doctorCount !== undefined && <p className="mt-2 text-xs font-bold text-medical">{hospital.doctorCount} эмч бүртгэлтэй · {hospital.appointmentCount || 0} захиалга</p>}
                  </div>
                </button>
              ))}
              {filteredRows.length === 0 && <EmptyState />}
            </div>
            {filteredRows.length > 0 && (
              <div className="mt-5 flex justify-center gap-2">
                {Array.from({ length: pageCount }, (_, index) => index + 1).map((nextPage) => (
                  <button key={nextPage} className={`h-9 w-9 rounded-lg text-sm font-bold ${nextPage === page ? "bg-medical text-white" : "bg-cyanSoft text-medical"}`} onClick={() => { setPage(nextPage); setSelectedHospital(null); }}>
                    {nextPage}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="min-h-[420px] rounded-lg border border-sky-100 bg-white p-5 shadow-soft">
            <div className="grid h-full min-h-[360px] place-items-center rounded-lg bg-cyanSoft text-center text-sm text-slate-600">
              <div>
                <MapPin className="mx-auto text-medical" size={34} />
                <p className="mt-3 font-bold text-navy">{mapTitle}</p>
                <p className="mt-1">{filteredRows.length} байршил харагдаж байна.</p>
                {markerHospital && (
                  <div className="mt-4 rounded-2xl bg-white p-4 text-left shadow-sm">
                    <p className="text-xs font-bold text-medical">Сонгосон байршил</p>
                    <p className="mt-1 font-bold text-navy">{markerHospital.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{markerHospital.district} · {markerHospital.lat?.toFixed(4)}, {markerHospital.lng?.toFixed(4)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
      <HospitalModal hospital={modalHospital} onClose={() => setModalHospital(null)} />
      <DropdownStyles />
    </section>
  );
}

function HospitalModal({ hospital, onClose }: { hospital: HospitalRow | null; onClose: () => void }) {
  const [tab, setTab] = useState<"about" | "doctors">("about");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

  useEffect(() => {
    if (!hospital) return;
    setTab("about");
    api.get("/doctors", { params: { hospitalId: hospital.id, visit: "inPerson", limit: 80 } }).then((response) => setDoctors(response.data.data as Doctor[])).catch(() => setDoctors([]));
  }, [hospital]);

  useEffect(() => {
    if (!hospital) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [hospital]);

  if (!hospital) return null;
  const hospitalDoctors = doctors.filter((doctor) => !doctor.hospital?.id || doctor.hospital.id === hospital.id || normalize(doctor.hospital.name) === normalize(hospital.name));
  const specialties = hospitalDirections(hospital);

  return (
    <div className="fixed inset-0 z-[80] bg-slate-700/40 px-4 py-6 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="mx-auto max-h-[calc(100vh-3rem)] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-[0_24px_80px_rgba(14,116,144,0.25)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start gap-4 bg-gradient-to-br from-sky-500 to-medical p-6 text-white">
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-white text-medical shadow-sm"><Building2 size={38} /></div>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-extrabold">{hospital.name}</h2>
            <p className="mt-1 font-semibold text-cyan-50">{hospital.type}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-white/90">
              <span className="inline-flex items-center gap-1"><Phone size={15} />{hospital.phone}</span>
              <span className="inline-flex items-center gap-1"><Clock size={15} />{hospital.hours || "08:30 - 17:30"}</span>
            </div>
          </div>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 transition hover:bg-white/25" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="flex gap-2 border-b border-sky-100 px-6">
          <TabButton active={tab === "about"} onClick={() => setTab("about")}>Тухай</TabButton>
          <TabButton active={tab === "doctors"} onClick={() => setTab("doctors")}>Эмч нар</TabButton>
        </div>
        <div className="max-h-[58vh] overflow-y-auto p-6">
          {tab === "about" ? (
            <div className="grid gap-6">
              <section>
                <h3 className="text-lg font-bold text-navy">Үйл ажиллагааны чиглэл</h3>
                <div className="mt-3 flex flex-wrap gap-2">{specialties.map((item) => <span key={item} className="rounded-full bg-cyanSoft px-3 py-1 text-sm font-bold text-medical">{item}</span>)}</div>
              </section>
              <section>
                <h3 className="text-lg font-bold text-navy">7 хоногийн цагийн хуваарь</h3>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {schedule.map(([day, time]) => (
                    <div key={day} className="flex items-center justify-between rounded-xl border border-sky-100 px-4 py-3 text-sm">
                      <span className="font-bold text-navy">{day}</span>
                      <span className={time === "Амрана" ? "font-semibold text-slate-400" : "font-semibold text-medical"}>{time}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className="grid gap-3">
              {hospitalDoctors.map((doctor) => {
                const name = `${doctor.user.lastName || ""} ${doctor.user.firstName}`.trim();
                return (
                  <button key={doctor.id} type="button" className="flex gap-3 rounded-2xl border border-sky-100 p-4 text-left transition hover:bg-cyanSoft" onClick={() => setSelectedDoctor(doctor)}>
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-cyanSoft font-bold text-medical">{name.slice(0, 2)}</div>
                    <div>
                      <p className="font-bold text-navy">{name}</p>
                      <p className="mt-1 text-sm font-semibold text-medical">{doctor.specialty}</p>
                    </div>
                  </button>
                );
              })}
              {hospitalDoctors.length === 0 && <p className="rounded-2xl border border-dashed border-sky-100 bg-cyanSoft p-5 text-center font-bold text-navy">Энэ эмнэлэгт бүртгэлтэй эмч одоогоор алга.</p>}
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-sky-100 p-5">
          <Link href={`/patient/home/appointment/hospital?hospitalId=${encodeURIComponent(hospital.id)}&hospitalName=${encodeURIComponent(hospital.name)}`} className="rounded-xl bg-medical px-5 py-3 text-sm font-bold text-white hover:bg-sky-600">Цаг авах</Link>
          <button className="inline-flex items-center gap-2 rounded-xl border border-sky-100 px-5 py-3 text-sm font-bold text-medical hover:bg-cyanSoft"><Navigation size={16} />Байршил харах</button>
        </div>
      </div>
      <DoctorProfileModal doctor={selectedDoctor} onClose={() => setSelectedDoctor(null)} />
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" className={`border-b-2 px-4 py-4 text-sm font-bold ${active ? "border-medical text-medical" : "border-transparent text-slate-500 hover:text-medical"}`} onClick={onClick}>{children}</button>;
}

function HospitalFilterControls({ openNow, onOpenNowChange, location, onLocationChange, selectedDirections, onDirectionsChange }: { openNow: boolean; onOpenNowChange: (value: boolean) => void; location: string; onLocationChange: (value: string) => void; selectedDirections: string[]; onDirectionsChange: (value: string[]) => void }) {
  return (
    <>
      <label className="flex items-center justify-between rounded-lg border border-sky-100 px-3 py-3 text-sm font-semibold text-slate-700">
        Одоо нээлттэй
        <button type="button" aria-pressed={openNow} className={cn("relative h-6 w-11 rounded-full transition", openNow ? "bg-medical" : "bg-slate-200")} onClick={() => onOpenNowChange(!openNow)}>
          <span className={cn("absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition", openNow ? "left-6" : "left-1")} />
        </button>
      </label>
      <SingleSelectDropdown label="Байршил" searchPlaceholder="Хот/аймаг хайх..." options={locations} value={location} onChange={onLocationChange} />
      <MultiSelectDropdown label="Үйл ажиллагааны чиглэл" options={directions} values={selectedDirections} onChange={onDirectionsChange} />
    </>
  );
}

function SingleSelectDropdown({ label, searchPlaceholder, options, value, onChange }: { label: string; searchPlaceholder: string; options: string[]; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const filtered = options.filter((option) => normalize(option).includes(normalize(query)));
  useOutsideClose(rootRef, () => setOpen(false));
  return (
    <div ref={rootRef} className="relative">
      <button type="button" className="flex w-full items-center justify-between rounded-lg border border-sky-100 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-cyanSoft hover:text-medical" onClick={() => setOpen((current) => !current)}>
        <span>{label}</span><span className="flex min-w-0 items-center gap-2 text-xs text-medical"><span className="max-w-[110px] truncate">{value}</span><ChevronDown size={16} /></span>
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-30 w-full overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-[0_18px_50px_rgba(14,165,233,0.18)]">
          <div className="flex items-center gap-2 border-b border-sky-100 px-3 py-2"><Search size={16} className="text-medical" /><input className="h-9 w-full text-sm outline-none" placeholder={searchPlaceholder} value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <div className="dropdown-scroll max-h-72 overflow-y-auto py-2">
            {filtered.map((option) => <button key={option} type="button" className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-cyanSoft hover:text-medical" onClick={() => { onChange(option); setOpen(false); }}>{option}<span className={cn("grid h-5 w-5 place-items-center rounded-full border", value === option ? "border-medical bg-medical text-white" : "border-sky-100 text-transparent")}><Check size={13} /></span></button>)}
          </div>
        </div>
      )}
    </div>
  );
}

function MultiSelectDropdown({ label, options, values, onChange }: { label: string; options: string[]; values: string[]; onChange: (value: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useOutsideClose(rootRef, () => setOpen(false));
  const labelText = values.length > 0 ? `${values.length} сонгосон` : "Бүгд";
  function toggle(option: string) {
    if (option === "Бүгд") return onChange([]);
    onChange(values.includes(option) ? values.filter((item) => item !== option) : [...values, option]);
  }
  return (
    <div ref={rootRef} className="relative">
      <button type="button" className="flex w-full items-center justify-between rounded-lg border border-sky-100 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-cyanSoft hover:text-medical" onClick={() => setOpen((current) => !current)}>
        <span>{label}</span><span className="flex items-center gap-2 text-xs text-medical">{labelText}<ChevronDown size={16} /></span>
      </button>
      {open && <div className="absolute left-0 top-[calc(100%+8px)] z-30 w-full overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-[0_18px_50px_rgba(14,165,233,0.18)]"><div className="dropdown-scroll max-h-80 overflow-y-auto py-2">{options.map((option) => { const checked = option === "Бүгд" ? values.length === 0 : values.includes(option); return <button key={option} type="button" className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-cyanSoft hover:text-medical" onClick={() => toggle(option)}><span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-md border", checked ? "border-medical bg-medical text-white" : "border-sky-100 text-transparent")}><Check size={13} /></span>{option}</button>; })}</div></div>}
    </div>
  );
}

function EmptyState() {
  return <div className="grid min-h-56 place-items-center rounded-lg border border-dashed border-sky-100 bg-cyanSoft text-center"><div><Building2 className="mx-auto text-medical" size={34} /><p className="mt-3 font-bold text-navy">Илэрц олдсонгүй</p><p className="mt-1 text-sm text-slate-600">Шүүлтүүрээ өөрчлөөд дахин үзнэ үү.</p></div></div>;
}

function useOutsideClose(ref: RefObject<HTMLDivElement | null>, onClose: () => void) {
  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [onClose, ref]);
}

function getRows(mode: SearchMode): HospitalRow[] {
  if (mode === "state") return [
    { id: "state-1", name: "Улсын Нэгдүгээр Төв Эмнэлэг", type: "Улсын эмнэлэг", district: "Сүхбаатар", phone: "7711-1111", rating: 4.6, openNow: true, hours: "08:30 - 17:30" },
    { id: "state-2", name: "Улсын Хоёрдугаар Төв Эмнэлэг", type: "Улсын эмнэлэг", district: "Баянзүрх", phone: "7015-0222", rating: 4.5, openNow: true, hours: "08:30 - 17:30" },
    { id: "state-3", name: "Эх хүүхдийн эрүүл мэндийн үндэсний төв", type: "Улсын эмнэлэг", district: "Баянгол", phone: "362-205", rating: 4.7, openNow: false, hours: "09:00 - 16:00" },
  ];
  if (mode === "laboratory") return laboratoryRows;
  if (mode === "package") return packageRows;
  const extraNames = ["Энэрэл клиник", "Гранд Мед", "Интермед", "UB Songdo Hospital", "Эм Жэй эмнэлэг", "Ачтан клиник", "Гурван гал", "Тод Эйч", "Мөнгөн гүүр", "Бриллиант", "Скай Мед", "Итгэл эмнэлэг", "Оточ Манрамба", "Сонор Мед"];
  const base = hospitals.map((hospital, index) => ({ ...hospital, type: "Хувийн эмнэлэг", phone: "1800-2026", openNow: index !== 2, hours: index === 2 ? "09:00 - 16:00" : "08:30 - 17:30" }));
  const extras = extraNames.map((name, index) => {
    const template = hospitals[index % hospitals.length];
    return {
      ...template,
      id: `extra-${index + 1}`,
      name,
      type: "Хувийн эмнэлэг",
      district: ubDistricts[index % ubDistricts.length],
      phone: `75${String(index + 11).padStart(2, "0")}-2026`,
      lat: (template.lat || 47.9) + index * 0.004,
      lng: (template.lng || 106.9) + index * 0.004,
      openNow: index % 4 !== 1,
      hours: index % 4 === 1 ? "09:00 - 16:00" : "08:30 - 17:30",
    };
  });
  return [...base, ...extras];
}

function inferLocation(hospital: HospitalRow) {
  const text = normalize(`${hospital.district} ${hospital.name}`);
  if (ubDistricts.some((district) => text.includes(normalize(district))) || text.includes("ulaanbaatar")) return "Улаанбаатар";
  return hospital.district;
}

function hospitalDirections(hospital: HospitalRow) {
  const registered = hospital.doctors?.map((doctor) => doctor.specialty).filter(Boolean) || [];
  if (registered.length) return Array.from(new Set(registered));
  const text = normalize(`${hospital.name} ${hospital.type} ${hospital.district}`);
  const inferred = new Set<string>();
  if (text.includes(normalize("Хүүхэд")) || text.includes(normalize("эх барих")) || text.includes("narny")) ["Хүүхэд", "Эх барих, эмэгтэйчүүд", "Нярай"].forEach((item) => inferred.add(item));
  if (text.includes(normalize("Оношилгоо")) || text.includes(normalize("зөвлөгөө")) || text.includes("city")) ["Дотор", "Мэс засал", "Зүрх судас", "Нүд"].forEach((item) => inferred.add(item));
  if (text.includes(normalize("Нэгдсэн")) || text.includes("medicare") || text.includes("grand") || text.includes("intermed")) ["Дотор", "Зүрх судас", "Мэдрэл", "Мэс засал", "Уушги"].forEach((item) => inferred.add(item));
  if (text.includes("dental") || text.includes(normalize("шүд"))) inferred.add("Шүд");
  return inferred.size > 0 ? Array.from(inferred) : ["Дотор", "Сэргээн засах"];
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[,\s/-]/g, "");
}

function DropdownStyles() {
  return <style jsx global>{`
    .dropdown-scroll { scrollbar-width: none; }
    .dropdown-scroll::-webkit-scrollbar { width: 0; }
    .dropdown-scroll:hover { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
    .dropdown-scroll:hover::-webkit-scrollbar { width: 6px; }
    .dropdown-scroll:hover::-webkit-scrollbar-thumb { border-radius: 999px; background: #cbd5e1; }
  `}</style>;
}
