"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Baby,
  Bone,
  Brain,
  Building2,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  FlaskConical,
  HeartPulse,
  MessageCircle,
  Microscope,
  Pill,
  Search,
  ShieldPlus,
  Sparkles,
  Stethoscope,
  Syringe,
  TestTube2,
  type LucideIcon,
} from "lucide-react";
import { AppointmentFlowModal } from "@/components/appointments/AppointmentFlowModal";
import { appointmentSpecialties } from "@/components/appointments/specialtyOptions";
import { ImmediateConsultationModal } from "@/components/consultation/ImmediateConsultationModal";
import { HealthPackageModal } from "@/components/packages/HealthPackageModal";
import { api } from "@/services/api";
import { useAuthStore } from "@/store/auth.store";

const shortcuts = [
  { title: "Цаг захиалах", action: "appointment", icon: CalendarPlus },
  { title: "Яг одоо зөвлөгөө авах", action: "consultation", icon: MessageCircle },
  { title: "Багц шинжилгээ захиалах", action: "health-package", icon: FlaskConical },
  { title: "Шинжилгээний хариу авах", href: "/dashboard/patient?section=labs", icon: ClipboardCheck },
];

const specialtyIcons: LucideIcon[] = [Stethoscope, ShieldPlus, Pill, Bone, Sparkles, HeartPulse, Brain, Syringe, Microscope, Baby];

type PatientAppointment = {
  id: string;
  scheduledAt: string;
  type?: string;
  room?: string;
  specialty?: string;
  paymentStatus?: string;
  packageName?: string;
  labName?: string;
  doctor: {
    specialty: string;
    hospital?: { name: string } | null;
    chatRooms?: Array<{ id: string }>;
    user: { firstName: string; lastName?: string };
  };
};

type DoctorSearchResult = {
  id: string;
  specialty?: string | null;
  experience?: number | null;
  fee?: number | null;
  online?: boolean | null;
  hospital?: { name?: string | null } | null;
  user?: { firstName?: string | null; lastName?: string | null };
};

type HospitalSearchResult = {
  id: string;
  name: string;
  type?: string | null;
  address?: string | null;
  phone?: string | null;
  hours?: string | null;
  district?: string | null;
  departments?: Array<{ name?: string | null }>;
};

type LabSearchResult = {
  id: string;
  title: string;
  code?: string;
  labName?: string;
  issuedAt?: string;
  status?: string;
  summary?: string;
  doctorNote?: string;
};

export function PatientHome() {
  const user = useAuthStore((state) => state.user);
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [consultationOpen, setConsultationOpen] = useState(false);
  const [healthPackageOpen, setHealthPackageOpen] = useState(false);
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [doctorResults, setDoctorResults] = useState<DoctorSearchResult[]>([]);
  const [hospitalResults, setHospitalResults] = useState<HospitalSearchResult[]>([]);
  const [labResults, setLabResults] = useState<LabSearchResult[]>([]);
  const [specialtyIndex, setSpecialtyIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"next" | "previous">("next");
  const carouselRef = useRef<HTMLDivElement>(null);
  const lastWheelTimeRef = useRef(0);
  const visibleSpecialties = appointmentSpecialties.slice(specialtyIndex, specialtyIndex + 5);
  const canMovePrevious = specialtyIndex > 0;
  const canMoveNext = specialtyIndex < appointmentSpecialties.length - 5;

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("appointment") === "select") setAppointmentOpen(true);
  }, []);

  async function runHomeSearch() {
    const query = searchQuery.trim();
    setSearchPerformed(true);
    setSearchLoading(true);
    try {
      const [doctorsResponse, hospitalsResponse, labsResponse] = await Promise.all([
        api.get("/doctors", { params: query ? { q: query } : undefined }).catch(() => ({ data: { data: [] } })),
        api.get("/hospitals", { params: query ? { q: query } : undefined }).catch(() => ({ data: { data: [] } })),
        api.get("/lab-results/my").catch(() => ({ data: { data: [] } })),
      ]);

      const doctors = (doctorsResponse.data.data || []) as DoctorSearchResult[];
      const hospitals = (hospitalsResponse.data.data || []) as HospitalSearchResult[];
      const labs = (labsResponse.data.data || []) as LabSearchResult[];

      setDoctorResults(sortBySimilarity(doctors, query, (doctor) => `${doctor.user?.lastName || ""} ${doctor.user?.firstName || ""} ${doctor.specialty || ""} ${doctor.hospital?.name || ""}`).slice(0, 6));
      setHospitalResults(sortBySimilarity(hospitals, query, (hospital) => `${hospital.name} ${hospital.type || ""} ${hospital.address || ""} ${hospital.district || ""} ${(hospital.departments || []).map((department) => department.name || "").join(" ")}`).slice(0, 6));
      setLabResults(sortBySimilarity(labs, query, (lab) => `${lab.title} ${lab.code || ""} ${lab.labName || ""} ${lab.status || ""} ${lab.summary || ""} ${lab.doctorNote || ""}`).slice(0, 6));
    } finally {
      setSearchLoading(false);
    }
  }

  useEffect(() => {
    async function loadAppointments() {
      try {
        const [myResponse, allResponse] = await Promise.all([
          api.get("/appointments/my").catch(() => ({ data: { data: [] } })),
          api.get("/appointments").catch(() => ({ data: { data: [] } })),
        ]);
        const byId = new Map<string, PatientAppointment>();
        for (const appointment of [...((myResponse.data.data || []) as PatientAppointment[]), ...((allResponse.data.data || []) as PatientAppointment[])]) {
          if (appointment?.id && appointment?.scheduledAt && appointment?.doctor?.user) byId.set(appointment.id, appointment);
        }
        const now = Date.now();
        setAppointments(Array.from(byId.values())
          .filter((appointment) => {
            const scheduledTime = new Date(appointment.scheduledAt).getTime();
            return !Number.isNaN(scheduledTime) && scheduledTime >= now;
          })
          .sort((first, second) => new Date(first.scheduledAt).getTime() - new Date(second.scheduledAt).getTime()));
      } catch {
        setAppointments([]);
      }
    }
    void loadAppointments();
  }, []);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      event.stopPropagation();

      const now = Date.now();
      if (now - lastWheelTimeRef.current < 450) return;
      lastWheelTimeRef.current = now;

      const direction = event.deltaY > 0 || event.deltaX > 0 ? 1 : -1;
      moveSpecialties(direction);
    }

    carousel.addEventListener("wheel", handleWheel, { passive: false });
    return () => carousel.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <div className="min-h-screen bg-[#f3f8f6] pb-20">
      <section className="patient-hero-grid relative z-20 overflow-hidden bg-[#f8fcfa] pb-10">
        <div className="pointer-events-none absolute left-1/2 top-16 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-100/60 blur-3xl" />
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <div className="relative z-10 mx-auto max-w-4xl py-16 text-center lg:py-24">
            <div>
              <h1 className="mx-auto max-w-3xl text-4xl font-black leading-tight tracking-tight text-[#111827] md:text-5xl">
                Сайн байна уу, {user?.firstName || "өвчтөн"}?
                <span className="block text-medical">Эрүүл мэндээ нэг дор удирдаарай.</span>
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base font-semibold leading-7 text-slate-500">
                Эмч, эмнэлэг, шинжилгээ, зөвлөгөө болон захиалсан цагуудаа нэг цэгээс хялбар хянаарай.
              </p>
              <div className="mx-auto mt-9 flex max-w-3xl items-center rounded-full bg-white p-2 pl-6 text-slate-500 shadow-[0_18px_50px_rgba(19,80,68,0.10)] ring-1 ring-emerald-100">
                <Stethoscope className="text-medical" size={22} />
                <input
                  className="ml-4 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
                  placeholder="Эмч, эмнэлэг, шинжилгээ хайх..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void runHomeSearch();
                  }}
                />
                <button type="button" className="inline-flex h-12 items-center gap-2 rounded-full bg-medical px-8 text-sm font-extrabold text-white transition hover:bg-[#1d6758]" onClick={() => void runHomeSearch()}>
                  <Search size={17} />
                  Хайх
                </button>
              </div>
              {searchPerformed && (
                <div className="mx-auto mt-5 max-w-5xl rounded-3xl border border-emerald-100 bg-white p-5 text-left shadow-[0_18px_50px_rgba(19,80,68,0.10)]">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-extrabold text-navy">Хайлтын илэрц</h2>
                    <span className="text-xs font-bold text-slate-400">{searchLoading ? "Хайж байна..." : `${doctorResults.length + hospitalResults.length + labResults.length} илэрц`}</span>
                  </div>
                  {!searchLoading && doctorResults.length + hospitalResults.length + labResults.length === 0 && (
                    <p className="mt-4 rounded-2xl bg-[#f4faf7] p-4 text-sm font-semibold text-slate-500">Илэрц олдсонгүй. Богино нэр, эмчийн мэргэжил, эмнэлэг эсвэл шинжилгээний нэрээр дахин хайна уу.</p>
                  )}
                  <div className="mt-4 grid gap-4 lg:grid-cols-3">
                    <SearchResultSection title="Эмч" icon={<Stethoscope size={18} />}>
                      {doctorResults.map((doctor) => {
                        const name = `${doctor.user?.lastName || ""} ${doctor.user?.firstName || ""}`.trim() || "Эмч";
                        return (
                          <Link key={doctor.id} href={`/patient/home/search/doctor?specialty=${encodeURIComponent(doctor.specialty || "")}`} className="block rounded-2xl border border-emerald-100 p-3 transition hover:bg-cyanSoft">
                            <p className="font-extrabold text-navy">{name}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-600">{doctor.specialty || "Мэргэжил тодорхойгүй"} · {doctor.experience || 0} жил</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">{doctor.hospital?.name || "Эмнэлэг бүртгээгүй"} · {formatMoney(doctor.fee || 30000)}</p>
                            <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-extrabold ${doctor.online ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{doctor.online ? "Active" : "Offline"}</span>
                          </Link>
                        );
                      })}
                    </SearchResultSection>
                    <SearchResultSection title="Эмнэлэг" icon={<Building2 size={18} />}>
                      {hospitalResults.map((hospital) => (
                        <Link key={hospital.id} href={`/patient/home/search/hospital?q=${encodeURIComponent(hospital.name)}`} className="block rounded-2xl border border-emerald-100 p-3 transition hover:bg-cyanSoft">
                          <p className="font-extrabold text-navy">{hospital.name}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-600">{hospital.type || "Эмнэлэг"} · {hospital.district || "Байршил тодорхойгүй"}</p>
                          <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">{hospital.address || "Хаяг бүртгээгүй"}</p>
                          <p className="mt-1 text-xs font-semibold text-medical">{hospital.phone || hospital.hours || "Дэлгэрэнгүй харах"}</p>
                        </Link>
                      ))}
                    </SearchResultSection>
                    <SearchResultSection title="Шинжилгээ" icon={<FileText size={18} />}>
                      {labResults.map((lab) => (
                        <Link key={lab.id} href="/dashboard/patient?section=labs" className="block rounded-2xl border border-emerald-100 p-3 transition hover:bg-cyanSoft">
                          <p className="font-extrabold text-navy">{lab.title}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-600">{lab.labName || "Лаборатори"} · {lab.status || "Бэлэн"}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{lab.issuedAt ? formatShortDate(lab.issuedAt) : lab.code || "Огноо тодорхойгүй"}</p>
                          <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">{lab.doctorNote || lab.summary || "Тайлбар алга"}</p>
                        </Link>
                      ))}
                    </SearchResultSection>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <main className="relative z-30 mx-auto -mt-14 max-w-7xl px-4 sm:px-6">
        <section>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {shortcuts.map(({ title, href, action, icon: Icon }) => (
            action === "appointment" ? (
              <button key={title} type="button" className="group flex min-h-[150px] flex-col items-center justify-center rounded-2xl border border-emerald-100 bg-white p-5 text-center shadow-[0_16px_42px_rgba(19,80,68,0.08)] transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_24px_60px_rgba(19,80,68,0.14)]" onClick={() => setAppointmentOpen(true)}>
                <div className="grid h-14 w-14 place-items-center rounded-full bg-cyanSoft text-medical transition group-hover:bg-medical group-hover:text-white"><Icon size={25} /></div>
                <p className="mt-5 font-extrabold leading-5 text-[#263238]">{title}</p>
              </button>
            ) : action === "consultation" ? (
              <button key={title} type="button" className="group flex min-h-[150px] flex-col items-center justify-center rounded-2xl border border-emerald-100 bg-white p-5 text-center shadow-[0_16px_42px_rgba(19,80,68,0.08)] transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_24px_60px_rgba(19,80,68,0.14)]" onClick={() => setConsultationOpen(true)}>
                <div className="grid h-14 w-14 place-items-center rounded-full bg-cyanSoft text-medical transition group-hover:bg-medical group-hover:text-white"><Icon size={25} /></div>
                <p className="mt-5 font-extrabold leading-5 text-[#263238]">{title}</p>
              </button>
            ) : action === "health-package" ? (
              <button key={title} type="button" className="group flex min-h-[150px] flex-col items-center justify-center rounded-2xl border border-emerald-100 bg-white p-5 text-center shadow-[0_16px_42px_rgba(19,80,68,0.08)] transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_24px_60px_rgba(19,80,68,0.14)]" onClick={() => setHealthPackageOpen(true)}>
                <div className="grid h-14 w-14 place-items-center rounded-full bg-cyanSoft text-medical transition group-hover:bg-medical group-hover:text-white"><Icon size={25} /></div>
                <p className="mt-5 font-extrabold leading-5 text-[#263238]">{title}</p>
              </button>
            ) : (
            <Link key={title} href={href || "#"} className="group flex min-h-[150px] flex-col items-center justify-center rounded-2xl border border-emerald-100 bg-white p-5 text-center shadow-[0_16px_42px_rgba(19,80,68,0.08)] transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_24px_60px_rgba(19,80,68,0.14)]">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-cyanSoft text-medical transition group-hover:bg-medical group-hover:text-white"><Icon size={25} /></div>
              <p className="mt-5 font-extrabold leading-5 text-[#263238]">{title}</p>
            </Link>
            )
          ))}
        </div>
        </section>

        <section className="mt-12 rounded-[28px] border border-sky-100 bg-white p-5 shadow-[0_16px_42px_rgba(25,105,89,0.08)] sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-[#12312f]">Та ямар эмч хайж байна вэ?</h2>
            <div className="flex items-center gap-2">
              <Link href="/patient/home/specialties" className="text-sm font-bold text-medical hover:text-sky-600">
                Бүгдийг харах (38)
              </Link>
              <button type="button" aria-label="Previous specialties" className="grid h-10 w-10 place-items-center rounded-full border border-sky-100 bg-white text-medical shadow-sm hover:bg-cyanSoft disabled:cursor-not-allowed disabled:opacity-40" disabled={!canMovePrevious} onClick={() => moveSpecialties(-1)}>
                <ChevronLeft size={20} />
              </button>
              <button type="button" aria-label="Next specialties" className="grid h-10 w-10 place-items-center rounded-full border border-sky-100 bg-white text-medical shadow-sm hover:bg-cyanSoft disabled:cursor-not-allowed disabled:opacity-40" disabled={!canMoveNext} onClick={() => moveSpecialties(1)}>
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
          <div
            ref={carouselRef}
            className="overflow-hidden"
          >
            <div key={specialtyIndex} className={`grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 ${slideDirection === "next" ? "animate-specialty-next" : "animate-specialty-previous"}`}>
              {visibleSpecialties.map((item) => {
                const realIndex = appointmentSpecialties.indexOf(item);
                const Icon = specialtyIcons[realIndex % specialtyIcons.length];
                return (
                  <Link
                    key={item}
                    href={`/patient/home/search/doctor?specialty=${encodeURIComponent(item)}`}
                    className="group flex h-40 w-full flex-col items-center justify-center rounded-2xl border border-sky-100 bg-white p-4 text-center shadow-sm transition hover:-translate-y-1 hover:border-cyan-200 hover:shadow-[0_18px_36px_rgba(25,105,89,0.14)]"
                  >
                    <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-cyanSoft text-medical transition group-hover:bg-medical group-hover:text-white">
                      <Icon size={30} />
                    </div>
                    <p className="mt-4 text-sm font-bold leading-5 text-medical">{item}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_28px_rgba(19,80,68,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-extrabold text-[#263238]">Захиалсан цагууд</h2>
              <Link href="/dashboard/patient?section=orders" className="text-xs font-extrabold text-medical hover:text-[#1d6758]">Бүх захиалга</Link>
            </div>
            <div className="patient-home-scroll mt-4 grid max-h-[500px] gap-3 overflow-y-auto pr-2">
              {appointments.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-200 bg-[#f4faf7] p-5 text-center text-sm font-semibold text-slate-500">Захиалсан цаг одоогоор алга.</div>
              )}
              {appointments.map((appointment) => {
                const date = new Date(appointment.scheduledAt);
                const doctorName = `${appointment.doctor.user.lastName || ""} ${appointment.doctor.user.firstName}`.trim();
                const chatRoomId = appointment.doctor.chatRooms?.[0]?.id;
                const isHospitalVisit = appointment.type === "HOSPITAL_VISIT";
                const isPackageOrder = appointment.type === "PACKAGE_ORDER";
                return (
                  <article key={appointment.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-[#f5faf8] p-4 transition hover:border-emerald-200 hover:bg-white">
                    <div>
                      <p className="text-xs font-extrabold text-medical">{date.toLocaleDateString("mn-MN", { month: "short", day: "numeric" })} · {date.toLocaleDateString("mn-MN", { weekday: "long" })}</p>
                      <p className="mt-1 text-xl font-black text-[#263238]">{date.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })}</p>
                      <p className="mt-2 text-sm font-extrabold text-navy">{isPackageOrder ? appointment.packageName || "Багц шинжилгээ" : doctorName}</p>
                      <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-600">{isPackageOrder ? "Багц шинжилгээ" : isHospitalVisit ? "Биечлэн үзүүлэх" : "Онлайн зөвлөгөө"}{!isPackageOrder ? ` · ${appointment.specialty || appointment.doctor.specialty}` : ""}{appointment.room ? ` · Өрөө ${appointment.room}` : ""} · {appointment.paymentStatus === "PAID" ? "Төлбөр төлөгдсөн" : "Төлбөр хүлээгдэж байгаа"}</p>
                      {!isHospitalVisit && !isPackageOrder && chatRoomId && (
                        <Link href={`/chat?roomId=${chatRoomId}`} className="mt-3 inline-flex items-center gap-2 text-sm font-extrabold text-medical transition hover:text-[#1d6758]">
                          <MessageCircle size={15} />
                          Чатлах
                        </Link>
                      )}
                    </div>
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-sm font-extrabold text-medical shadow-sm">{doctorName.slice(0, 2)}</div>
                  </article>
                );
              })}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_28px_rgba(19,80,68,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-extrabold text-[#263238]">Шинжилгээ</h2>
              <Link href="/dashboard/patient?section=labs" className="text-xs font-extrabold text-medical hover:text-[#1d6758]">Бүх хариу</Link>
            </div>
            <Link href="/dashboard/patient?section=labs" className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600 transition hover:border-emerald-200 hover:bg-cyanSoft">
              <span className="flex items-center gap-3"><TestTube2 className="text-medical" size={20} /> CBC-2026-001 хариу бэлэн</span>
              <span className="text-xl text-slate-300">›</span>
            </Link>
            <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white px-4 py-5 text-center text-sm font-semibold italic text-slate-400">Бусад шинжилгээ хүлээгдэж байна...</div>
            <h3 className="mt-6 text-sm font-extrabold text-[#263238]">Шуурхай мэдээлэл</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-rose-100 bg-[#fbf0ec] p-4">
                <p className="text-xs font-bold text-rose-500">Цусны даралт</p>
                <p className="mt-2 text-2xl font-black text-[#263238]">120/80</p>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-[#e8fbf6] p-4">
                <p className="text-xs font-bold text-medical">Зүрхний цохилт</p>
                <p className="mt-2 text-2xl font-black text-[#263238]">72 bpm</p>
              </div>
            </div>
          </section>
        </div>

      </main>
      <AppointmentFlowModal open={appointmentOpen} onClose={() => setAppointmentOpen(false)} />
      <ImmediateConsultationModal open={consultationOpen} onClose={() => setConsultationOpen(false)} />
      <HealthPackageModal open={healthPackageOpen} onClose={() => setHealthPackageOpen(false)} />
      <style jsx>{`
        .animate-specialty-next {
          animation: specialtyNext 320ms ease-out;
        }

        .animate-specialty-previous {
          animation: specialtyPrevious 320ms ease-out;
        }

        @keyframes specialtyNext {
          from {
            opacity: 0.72;
            transform: translateX(28px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes specialtyPrevious {
          from {
            opacity: 0.72;
            transform: translateX(-28px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .patient-home-scroll {
          scrollbar-width: thin;
          scrollbar-color: #d7dede transparent;
        }

        .patient-home-scroll::-webkit-scrollbar {
          width: 8px;
        }

        .patient-home-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .patient-home-scroll::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: #d7dede;
        }

        .patient-hero-grid {
          background-image:
            linear-gradient(135deg, rgba(35, 123, 104, 0.055) 0 1px, transparent 1px),
            radial-gradient(circle at 8% 34%, rgba(24, 173, 146, 0.12), transparent 0 118px),
            radial-gradient(circle at 88% 42%, rgba(35, 123, 104, 0.07), transparent 0 170px);
          background-size: 34px 34px, auto, auto;
        }
      `}</style>
    </div>
  );

function moveSpecialties(direction: -1 | 1) {
    setSpecialtyIndex((current) => {
      const next = Math.min(Math.max(current + direction, 0), appointmentSpecialties.length - 5);
      if (next !== current) setSlideDirection(direction === 1 ? "next" : "previous");
      return next;
    });
  }
}

function SearchResultSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-sm font-extrabold text-medical">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-cyanSoft">{icon}</span>
        {title}
      </h3>
      <div className="mt-3 grid max-h-80 gap-2 overflow-y-auto pr-1 [scrollbar-color:#d7dede_transparent] [scrollbar-width:thin]">
        {children}
      </div>
    </section>
  );
}

function sortBySimilarity<T>(items: T[], query: string, textOf: (item: T) => string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return items;
  return [...items]
    .map((item) => ({ item, score: similarityScore(normalizedQuery, normalizeSearchText(textOf(item))) }))
    .filter(({ score }) => score > 0)
    .sort((first, second) => second.score - first.score)
    .map(({ item }) => item);
}

function similarityScore(query: string, text: string) {
  if (!query) return 1;
  if (text.includes(query)) return 100 - Math.min(text.indexOf(query), 30);
  const parts = query.split(/\s+/).filter(Boolean);
  const tokenMatches = parts.filter((part) => text.includes(part)).length;
  if (tokenMatches) return 50 + tokenMatches;
  if (query.length < 3) return 0;
  return text.split(/\s+/).some((word) => word.startsWith(query.slice(0, 3))) ? 25 : 0;
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function formatMoney(value: number) {
  return `${Math.round(value).toLocaleString("en-US")}₮`;
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

