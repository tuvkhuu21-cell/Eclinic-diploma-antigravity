"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Download, Eye, FileText, FileX2, MessageCircle, Star, Stethoscope, Video, X } from "lucide-react";
import { PatientSidebar, type PatientSection } from "./PatientSidebar";
import { PatientProfileForm } from "./PatientProfileForm";
import { PatientHealthForm } from "./PatientHealthForm";
import { PatientLifestyleForm } from "./PatientLifestyleForm";
import { api } from "@/services/api";
import { useAuthStore } from "@/store/auth.store";
import { broadcastRealtime } from "@/lib/supabase-realtime";

export function PatientDashboardContent() {
  const router = useRouter();
  const { hasHydrated, token, role, user } = useAuthStore();
  const [section, setSection] = useState<PatientSection>("labs");
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);

  useEffect(() => {
    if (!hasHydrated) return;
    const activeRole = user?.role || role;
    if (!token) {
      router.replace("/");
      return;
    }
    if (activeRole === "DOCTOR") router.replace("/dashboard/doctor");
  }, [hasHydrated, role, router, token, user?.role]);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("section");
    if (requested === "profile") setSection("personal");
    if (requested === "labs") setSection("labs");
    if (requested === "appointments") setSection("appointments");
    if (requested === "doctors") setSection("doctors");
    if (requested === "orders") setSection("orders");
  }, []);

  // Single shared fetch for all appointment-dependent sections
  useEffect(() => {
    let cancelled = false;
    api.get("/appointments/my")
      .then((response) => { if (!cancelled) setAppointments(response.data.data as PatientAppointment[]); })
      .catch(() => { if (!cancelled) setAppointments([]); })
      .finally(() => { if (!cancelled) setAppointmentsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (!hasHydrated) return <section className="min-h-screen bg-slate-50" />;
  if (user?.role === "DOCTOR" || role === "DOCTOR") return <section className="min-h-screen bg-slate-50" />;

  return (
    <section className="bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <PatientSidebar active={section} onSelect={setSection} />
          <main>
            {section === "personal" && <PatientProfileForm />}
            {section === "health" && <PatientHealthForm />}
            {section === "lifestyle" && <PatientLifestyleForm />}
            {section === "labs" && <LabResultsSection />}
            {section === "doctors" && <MyDoctorsSection appointments={appointments} loading={appointmentsLoading} />}
            {section === "appointments" && <AppointmentHistorySection appointments={appointments} loading={appointmentsLoading} />}
            {section === "orders" && <OrderHistorySection appointments={appointments} loading={appointmentsLoading} />}
          </main>
        </div>
      </div>
    </section>
  );
}

type LabResultRow = {
  id: string;
  code: string;
  title: string;
  labName: string;
  issuedAt: string;
  status: string;
  sourceType?: "private" | "state" | string;
  doctorNote: string;
  values?: Array<{ name?: string; value?: string; unit?: string; range?: string }>;
  fileUrl?: string;
  fileName?: string;
};

const fallbackLabResults: LabResultRow[] = [
  {
    id: "fallback-private-cbc",
    code: "CBC-DEMO-001",
    title: "Цусны ерөнхий шинжилгээ",
    labName: "Элиторчи лаборатори",
    issuedAt: "2026-05-10T09:30:00.000Z",
    status: "Бэлэн",
    sourceType: "private",
    doctorNote: "Гемоглобин, цагаан эс, ялтас хэвийн байна. Үрэвслийн идэвхжил ажиглагдсангүй.",
    values: [
      { name: "WBC", value: "6.1", unit: "10^9/L", range: "4.0-10.0" },
      { name: "HGB", value: "135", unit: "g/L", range: "120-160" },
      { name: "PLT", value: "250", unit: "10^9/L", range: "150-400" },
    ],
  },
  {
    id: "fallback-private-vitd",
    code: "VITD-DEMO-002",
    title: "Витамин D",
    labName: "Нарны шинжилгээний төв",
    issuedAt: "2026-05-09T09:30:00.000Z",
    status: "Бэлэн",
    sourceType: "private",
    doctorNote: "Витамин D бага зэрэг дутагдалтай. Эмчтэй зөвлөн нэмэлт хэрэглэх боломжтой.",
    values: [
      { name: "Vitamin D", value: "24", unit: "ng/mL", range: "30-100" },
      { name: "Calcium", value: "2.3", unit: "mmol/L", range: "2.1-2.6" },
    ],
  },
  {
    id: "fallback-state-liver",
    code: "LIVER-DEMO-003",
    title: "Элэгний үйл ажиллагаа",
    labName: "Улсын Нэгдүгээр Төв Эмнэлэг",
    issuedAt: "2026-05-08T09:30:00.000Z",
    status: "Бэлэн",
    sourceType: "state",
    doctorNote: "ALAT, ASAT хэвийн хүрээнд. Элэгний ачаалал нэмэгдсэн шинжгүй.",
    values: [
      { name: "ALAT", value: "24", unit: "U/L", range: "0-40" },
      { name: "ASAT", value: "22", unit: "U/L", range: "0-40" },
      { name: "GGT", value: "31", unit: "U/L", range: "0-55" },
    ],
  },
  {
    id: "fallback-state-kidney",
    code: "KIDNEY-DEMO-004",
    title: "Бөөрний үйл ажиллагаа",
    labName: "Улсын Хоёрдугаар Төв Эмнэлэг",
    issuedAt: "2026-05-07T09:30:00.000Z",
    status: "Бэлэн",
    sourceType: "state",
    doctorNote: "Креатинин хэвийн. Бөөрний шүүх үйл ажиллагаа тогтвортой байна.",
    values: [
      { name: "Creatinine", value: "72", unit: "umol/L", range: "45-90" },
      { name: "Uric acid", value: "310", unit: "umol/L", range: "150-360" },
    ],
  },
];

type PatientAppointment = {
  id: string;
  scheduledAt: string;
  durationMinutes?: number;
  type?: string;
  room?: string;
  specialty?: string;
  packageName?: string;
  labName?: string;
  price?: number;
  paymentStatus?: string;
  status?: string;
  doctor: {
    id: string;
    specialty: string;
    hospital?: { name: string; phone?: string; address?: string } | null;
    chatRooms?: Array<{ id: string }>;
    user: { id?: string; firstName: string; lastName?: string; email?: string; phone?: string };
  };
  videoCall?: { roomId: string; status?: string } | null;
};

function MyDoctorsSection({ appointments, loading }: { appointments: PatientAppointment[]; loading: boolean }) {
  const user = useAuthStore((state) => state.user);
  const [selectedDoctor, setSelectedDoctor] = useState<PatientAppointment | null>(null);

  const doctors = useMemo(() => {
    const map = new Map<string, PatientAppointment>();
    appointments.filter((appointment) => isPaidAppointment(appointment) && appointment.type !== "PACKAGE_ORDER").forEach((appointment) => {
      const key = `${appointment.doctor.user.lastName || ""}-${appointment.doctor.user.firstName}-${appointment.doctor.specialty}`;
      const current = map.get(key);
      if (!current || new Date(appointment.scheduledAt) > new Date(current.scheduledAt)) map.set(key, appointment);
    });
    return Array.from(map.values());
  }, [appointments]);

  if (loading) return <PanelShell title="Миний эмч"><p className="text-sm font-semibold text-slate-500">Эмчийн түүх ачаалж байна...</p></PanelShell>;

  return (
    <PanelShell title="Миний эмч">
      <div className="grid gap-4 md:grid-cols-2">
        {doctors.map((appointment) => {
          const doctorName = formatDoctorName(appointment);
          const chatRoomId = appointment.doctor.chatRooms?.[0]?.id;
          const isHospitalVisit = appointment.type === "HOSPITAL_VISIT";
          return (
            <article key={`${appointment.id}-${doctorName}`} className="cursor-pointer rounded-2xl border border-sky-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-medical hover:shadow-soft" onClick={() => setSelectedDoctor(appointment)}>
              <div className="flex gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-cyanSoft text-lg font-extrabold text-medical">{doctorName.slice(0, 2)}</div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-navy">{doctorName}</h3>
                  <p className="mt-1 text-sm font-semibold text-medical">{appointment.doctor.specialty}</p>
                  <p className="mt-1 text-sm text-slate-500">{appointment.doctor.hospital?.name || "Эмнэлэг сонгоогүй"}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">Сүүлийн цаг: {formatDateTime(appointment.scheduledAt)}{appointment.room ? ` · Өрөө ${appointment.room}` : ""}</p>
                  {isHospitalVisit && <span className="mt-2 inline-flex rounded-full bg-cyanSoft px-3 py-1 text-xs font-bold text-medical">Биечлэн</span>}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                {!isHospitalVisit && chatRoomId ? (
                  <Link href={`/chat?roomId=${chatRoomId}`} className="inline-flex items-center gap-2 rounded-full bg-medical px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-600">
                    <MessageCircle size={16} />
                    Чатлах
                  </Link>
                ) : !isHospitalVisit ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-400"><MessageCircle size={16} />Чат байхгүй</span>
                ) : null}
                {!isHospitalVisit && (
                  <button type="button" title="Видео дуудлага" aria-label="Видео дуудлага" className="grid h-10 w-10 place-items-center rounded-full bg-medical text-white transition hover:bg-sky-600" onClick={() => void startPatientVideoCall(appointment, user)}>
                    <Video size={17} />
                  </button>
                )}
              </div>
            </article>
          );
        })}
        {doctors.length === 0 && <EmptyState text="Төлбөр төлөгдсөн цагийн эмч одоогоор алга." />}
      </div>
      <DoctorInfoModal appointment={selectedDoctor} onClose={() => setSelectedDoctor(null)} />
    </PanelShell>
  );
}

function DoctorInfoModal({ appointment, onClose }: { appointment: PatientAppointment | null; onClose: () => void }) {
  useEffect(() => {
    if (!appointment) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [appointment, onClose]);

  if (!appointment) return null;
  const doctor = appointment.doctor;
  const name = formatDoctorName(appointment);

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-900/45 px-4 py-6 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="max-h-[calc(100vh-3rem)] w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-[0_24px_80px_rgba(14,116,144,0.25)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="relative bg-gradient-to-br from-sky-500 via-medical to-cyan-500 px-6 pb-8 pt-5 text-white">
          <button type="button" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/15 transition hover:bg-white/25" onClick={onClose} aria-label="Close doctor info"><X size={18} /></button>
          <div className="mt-10 flex items-end gap-5">
            <div className="mb-[-42px] grid h-24 w-24 shrink-0 place-items-center rounded-full border-4 border-white bg-cyanSoft text-2xl font-extrabold text-medical shadow-soft">{name.slice(0, 2)}</div>
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-extrabold">{name}</h2>
              <p className="mt-1 text-sm font-semibold text-cyan-50">{doctor.specialty} · {doctor.hospital?.name || "Эмнэлэг сонгоогүй"}</p>
            </div>
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-6 pt-14" style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>
          <div className="grid gap-4 md:grid-cols-2">
            <DoctorInfoRow icon={<Stethoscope size={18} />} label="Мэргэшил" value={doctor.specialty} />
            <DoctorInfoRow icon={<Star size={18} />} label="Эмнэлэг" value={doctor.hospital?.name} />
            <DoctorInfoRow icon={<MessageCircle size={18} />} label="Утас" value={doctor.hospital?.phone} />
            <DoctorInfoRow icon={<CalendarClock size={18} />} label="Имэйл" value={doctor.user.email} />
            <DoctorInfoRow icon={<Video size={18} />} label="Үнэ" value={appointment.price ? `${formatCurrency(appointment.price)}₮` : "30,000₮"} />
            <DoctorInfoRow icon={<CalendarClock size={18} />} label="Сүүлийн цаг" value={formatDateTime(appointment.scheduledAt)} />
          </div>
          <div className="mt-5 rounded-2xl border border-sky-100 bg-cyanSoft p-4">
            <p className="text-xs font-bold text-medical">Цаг захиалгын мэдээлэл</p>
            <p className="mt-2 text-sm font-semibold text-slate-600">{formatAppointmentType(appointment.type)} · {formatPaymentStatus(appointment.paymentStatus, appointment.status)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DoctorInfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-sky-100 bg-white p-3 shadow-sm">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyanSoft text-medical">{icon}</span>
      <div>
        <p className="text-xs font-bold text-slate-400">{label}</p>
        <p className="mt-1 text-sm font-semibold text-navy">{value || "Бүртгээгүй"}</p>
      </div>
    </div>
  );
}

function AppointmentHistorySection({ appointments, loading }: { appointments: PatientAppointment[]; loading: boolean }) {
  const rows = appointments.filter((appointment) => appointment.status || appointment.paymentStatus);

  if (loading) return <PanelShell title="Цаг захиалга"><p className="text-sm font-semibold text-slate-500">Цаг захиалгууд ачаалж байна...</p></PanelShell>;

  return (
    <PanelShell title="Цаг захиалга">
      <div className="grid gap-4">
        {rows.map((appointment) => {
          const doctorName = formatDoctorName(appointment);
          const chatRoomId = appointment.doctor.chatRooms?.[0]?.id;
          const isHospitalVisit = appointment.type === "HOSPITAL_VISIT";
          const isPackageOrder = appointment.type === "PACKAGE_ORDER";
          return (
            <article key={appointment.id} className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-bold text-navy">{isPackageOrder ? appointment.packageName || "Багц шинжилгээ" : doctorName}</h3>
                  <p className="mt-1 text-sm font-semibold text-medical">{formatAppointmentType(appointment.type)}{!isPackageOrder && appointment.specialty ? ` · ${appointment.specialty}` : ""}</p>
                  {isPackageOrder && <p className="mt-1 text-sm text-slate-600">{appointment.labName || appointment.doctor.hospital?.name || "Лаборатори"}</p>}
                  {isHospitalVisit && appointment.doctor.hospital?.name && <p className="mt-1 text-sm text-slate-600">{appointment.doctor.hospital.name}{appointment.room ? ` · Өрөө ${appointment.room}` : ""}</p>}
                  <p className="mt-2 text-sm text-slate-600">{formatDateTime(appointment.scheduledAt)} · {appointment.durationMinutes || 30} минут</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-full bg-cyanSoft px-3 py-1 text-medical">{formatPaymentStatus(appointment.paymentStatus, appointment.status)}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{formatStatus(appointment.status)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!isHospitalVisit && !isPackageOrder && chatRoomId && (
                    <Link href={`/chat?roomId=${chatRoomId}`} className="inline-flex items-center gap-2 rounded-full bg-medical px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-600">
                      <MessageCircle size={16} />
                      Чатлах
                    </Link>
                  )}
                  <button type="button" className="inline-flex items-center gap-2 rounded-full border border-sky-100 px-4 py-2 text-sm font-bold text-medical transition hover:bg-cyanSoft">
                    <FileText size={16} />
                    Дэлгэрэнгүй
                  </button>
                </div>
              </div>
            </article>
          );
        })}
        {rows.length === 0 && <EmptyState text="Захиалсан цаг одоогоор алга." />}
      </div>
    </PanelShell>
  );
}

function OrderHistorySection({ appointments, loading }: { appointments: PatientAppointment[]; loading: boolean }) {
  const rows = appointments
    .filter((appointment) => appointment.paymentStatus || appointment.status)
    .sort((left, right) => new Date(right.scheduledAt).getTime() - new Date(left.scheduledAt).getTime());

  if (loading) return <PanelShell title="Захиалгын түүх"><p className="text-sm font-semibold text-slate-500">Захиалгын түүх ачаалж байна...</p></PanelShell>;

  return (
    <PanelShell title="Захиалгын түүх">
      <div className="grid gap-3">
        {rows.map((appointment) => {
          const isPackageOrder = appointment.type === "PACKAGE_ORDER";
          const isHospitalVisit = appointment.type === "HOSPITAL_VISIT";
          const typeName = isPackageOrder
            ? appointment.packageName || "Багц шинжилгээ"
            : isHospitalVisit
              ? `${appointment.doctor.hospital?.name || "Эмнэлэг"} · ${appointment.specialty || appointment.doctor.specialty}`
              : `Онлайн зөвлөгөө · ${formatDoctorName(appointment)}`;
          return (
            <article key={`order-${appointment.id}`} className="grid gap-3 rounded-2xl border border-sky-100 bg-white p-4 shadow-sm transition hover:border-cyan-200 hover:bg-sky-50 md:grid-cols-[1.4fr_1fr_120px_150px] md:items-center">
              <div>
                <p className="text-sm font-extrabold text-navy">{typeName}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{formatAppointmentType(appointment.type)}</p>
              </div>
              <p className="text-sm font-semibold text-slate-600">{formatDateTime(appointment.scheduledAt)}</p>
              <p className="text-sm font-extrabold text-medical">{formatCurrency(appointment.price || 30000)}₮</p>
              <span className="w-fit rounded-full bg-cyanSoft px-3 py-1 text-xs font-bold text-medical">{formatPaymentStatus(appointment.paymentStatus, appointment.status)}</span>
            </article>
          );
        })}
        {rows.length === 0 && <EmptyState text="Захиалгын түүх одоогоор алга." />}
      </div>
    </PanelShell>
  );
}

function PanelShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-white p-6 shadow-soft">
      <h1 className="text-2xl font-bold text-navy">{title}</h1>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-sky-100 bg-cyanSoft text-center md:col-span-2">
      <div>
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white text-medical"><CalendarClock size={30} /></div>
        <p className="mt-4 font-bold text-navy">{text}</p>
      </div>
    </div>
  );
}

function isPaidAppointment(appointment: PatientAppointment) {
  return appointment.paymentStatus === "PAID" || appointment.status === "CONFIRMED" || appointment.status === "COMPLETED";
}

function formatDoctorName(appointment: PatientAppointment) {
  return `${appointment.doctor.user.lastName || ""} ${appointment.doctor.user.firstName}`.trim();
}

async function startPatientVideoCall(appointment: PatientAppointment, user?: { id: string; firstName: string; lastName?: string }) {
  const existingRoomId = appointment.videoCall?.roomId;
  if (existingRoomId) {
    void startPatientVideoCallInBackground({
      roomId: existingRoomId,
      doctorId: appointment.doctor.id,
      appointmentId: appointment.id,
      recipientUserId: appointment.doctor.user.id,
      callerId: user?.id,
      callerName: `${user?.lastName || ""} ${user?.firstName || "Үйлчлүүлэгч"}`.trim(),
    });
    window.location.href = `/video-call/${existingRoomId}?start=1`;
    return;
  }
  const response = await api.post("/video-calls", {
    doctorId: appointment.doctor.id,
    appointmentId: appointment.id,
  });
  const call = response.data.data as { roomId: string; status?: string };
  const roomId = call.roomId;
  if (call.status !== "active") {
    await api.patch("/video-calls", { roomId, status: "ringing" }).catch(() => null);
    const doctorUserId = appointment.doctor.user.id;
    if (doctorUserId) {
      void broadcastRealtime(`user-notifications-${doctorUserId}`, "incoming-video-call", {
        roomId,
        appointmentId: appointment.id,
        callerId: user?.id,
        callerName: `${user?.lastName || ""} ${user?.firstName || "Үйлчлүүлэгч"}`.trim(),
      });
    }
    void broadcastRealtime(`video-call-${roomId}`, "call-ringing", {
      roomId,
      appointmentId: appointment.id,
      callerId: user?.id,
    });
  }
  window.location.href = `/video-call/${roomId}${call.status === "active" ? "?accept=1" : "?start=1"}`;
}

async function startPatientVideoCallInBackground(data: { roomId: string; doctorId: string; appointmentId: string; recipientUserId?: string; callerId?: string; callerName: string }) {
  try {
    const response = await api.post("/video-calls", { doctorId: data.doctorId, appointmentId: data.appointmentId });
    const call = response.data.data as { roomId: string; status?: string };
    if (call.status !== "active") await api.patch("/video-calls", { roomId: call.roomId || data.roomId, status: "ringing" }).catch(() => null);
  } catch {
    await api.patch("/video-calls", { roomId: data.roomId, status: "ringing" }).catch(() => null);
  }
  if (data.recipientUserId) {
    void broadcastRealtime(`user-notifications-${data.recipientUserId}`, "incoming-video-call", {
      roomId: data.roomId,
      appointmentId: data.appointmentId,
      callerId: data.callerId,
      callerName: data.callerName,
    });
  }
  void broadcastRealtime(`video-call-${data.roomId}`, "call-ringing", {
    roomId: data.roomId,
    appointmentId: data.appointmentId,
    callerId: data.callerId,
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}.${month}.${day} ${hours}:${minutes}`;
}

function formatAppointmentType(type?: string) {
  if (type === "HOSPITAL_VISIT") return "Биечлэн үзүүлэх";
  if (type === "PACKAGE_ORDER") return "Багц шинжилгээ";
  return type === "ONLINE" || !type ? "Онлайн зөвлөгөө" : type;
}

function formatPaymentStatus(paymentStatus?: string, status?: string) {
  if (paymentStatus === "PAID" || status === "CONFIRMED" || status === "COMPLETED") return "Төлбөр төлөгдсөн";
  return "Төлбөр хүлээгдэж байгаа";
}

function formatStatus(status?: string) {
  if (status === "CONFIRMED") return "Баталгаажсан";
  if (status === "COMPLETED") return "Дууссан";
  if (status === "CANCELLED") return "Цуцлагдсан";
  return "Хүлээгдэж байгаа";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("mn-MN").format(value);
}

function LabResultsSection() {
  const [results, setResults] = useState<LabResultRow[]>([]);
  const [activeTab, setActiveTab] = useState<"private" | "state">("private");
  const [selectedResult, setSelectedResult] = useState<LabResultRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/lab-results/my")
      .then((response) => setResults(response.data.data as LabResultRow[]))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  const tabs: Array<{ key: "private" | "state"; label: string }> = [
    { key: "private", label: "Хувийн эмнэлэг" },
    { key: "state", label: "Улсын эмнэлэг" },
  ];
  const filteredResults = results.filter((result) => (result.sourceType === "state" ? "state" : "private") === activeTab);
  const visibleResults = filteredResults.length > 0 ? filteredResults : fallbackLabResults.filter((result) => result.sourceType === activeTab);
  return (
    <div className="rounded-lg bg-white p-6 shadow-soft">
      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-4">
        {tabs.map((tab) => (
          <button key={tab.key} type="button" className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === tab.key ? "bg-medical text-white" : "bg-slate-100 text-slate-600 hover:bg-cyanSoft hover:text-medical"}`} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-5">
        <h1 className="text-2xl font-bold text-navy">Шинжилгээ</h1>
        <p className="mt-1 text-sm text-slate-500">Лабораторийн хариунууд шинэ огноогоор эрэмбэлэгдэнэ.</p>
      </div>
      {loading ? (
        <p className="mt-6 rounded-2xl bg-cyanSoft p-5 text-sm font-semibold text-medical">Шинжилгээний хариу ачаалж байна...</p>
      ) : visibleResults.length === 0 ? (
        <div className="mt-6 grid min-h-80 place-items-center text-center">
          <div>
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-cyanSoft text-medical"><FileX2 size={38} /></div>
            <p className="mt-5 text-lg font-bold text-navy">Энэ хэсэгт шинжилгээний хариу байхгүй байна.</p>
          </div>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-sky-100">
          <div className="hidden grid-cols-[1.3fr_1fr_120px_100px_1.2fr_150px] gap-3 bg-cyanSoft px-4 py-3 text-xs font-bold uppercase tracking-wide text-medical lg:grid">
            <span>Шинжилгээ</span>
            <span>Эмнэлэг</span>
            <span>Огноо</span>
            <span>Статус</span>
            <span>Эмчийн тайлбар</span>
            <span>Үйлдэл</span>
          </div>
          <div className="divide-y divide-sky-100">
            {visibleResults.map((result) => (
              <article key={result.id} className="grid cursor-pointer gap-3 bg-white px-4 py-4 text-sm transition hover:bg-sky-50 lg:grid-cols-[1.3fr_1fr_120px_100px_1.2fr_150px] lg:items-center" onClick={() => setSelectedResult(result)}>
                <div>
                  <h2 className="font-bold text-navy">{result.title}</h2>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{result.code}</p>
                </div>
                <p className="font-semibold text-slate-600">{result.labName}</p>
                <p className="text-slate-600">{formatDateOnly(result.issuedAt)}</p>
                <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{result.status}</span>
                <p className="leading-6 text-slate-600">{result.doctorNote}</p>
                <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                  <button type="button" className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-100 px-3 py-2 text-xs font-bold text-medical transition hover:bg-cyanSoft" onClick={() => setSelectedResult(result)}>
                    <Eye size={14} />
                    Харах
                  </button>
                  {result.fileUrl ? (
                  <a href={result.fileUrl} download={result.fileName} className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-100 px-3 py-2 text-xs font-bold text-medical transition hover:bg-cyanSoft">
                    <Download size={14} />
                    Татах
                  </a>
                ) : (
                    <button type="button" className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-100 px-3 py-2 text-xs font-bold text-medical transition hover:bg-cyanSoft" onClick={() => downloadPreparedLabResult(result)}>
                      <Download size={14} />
                      Татах
                    </button>
                )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
      <LabResultPreviewModal result={selectedResult} onClose={() => setSelectedResult(null)} />
    </div>
  );
}

function LabResultPreviewModal({ result, onClose }: { result: LabResultRow | null; onClose: () => void }) {
  if (!result) return null;
  const values = result.values && result.values.length > 0 ? result.values : [
    { name: "Ерөнхий үзүүлэлт", value: "Хэвийн", unit: "", range: "Хэвийн" },
    { name: "Эмчийн тэмдэглэл", value: result.status, unit: "", range: "Бэлэн" },
  ];
  return (
    <div className="fixed inset-0 z-[100] bg-slate-700/40 px-4 py-6 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="mx-auto max-h-[calc(100vh-3rem)] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-[0_24px_80px_rgba(14,116,144,0.25)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-sky-500 to-medical p-6 text-white">
          <div>
            <p className="text-sm font-semibold text-cyan-50">Шинжилгээний дэлгэрэнгүй</p>
            <h2 className="mt-1 text-2xl font-extrabold">{result.title}</h2>
            <p className="mt-2 text-sm font-semibold text-white/90">{result.labName} · {formatDateOnly(result.issuedAt)}</p>
          </div>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 hover:bg-white/25" onClick={onClose} aria-label="Close lab result preview"><X size={18} /></button>
        </div>
        <div className="max-h-[68vh] overflow-y-auto p-6">
          <div className="grid gap-3 rounded-2xl bg-cyanSoft p-4 text-sm text-slate-700 md:grid-cols-2">
            <p><b className="text-medical">Өвчтөн:</b> Миний профайл</p>
            <p><b className="text-medical">Эмнэлэг:</b> {result.labName}</p>
            <p><b className="text-medical">Шинжилгээ:</b> {result.title}</p>
            <p><b className="text-medical">Огноо:</b> {formatDateOnly(result.issuedAt)}</p>
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-sky-100">
            <div className="grid grid-cols-[1.2fr_1fr_1fr] bg-cyanSoft px-4 py-3 text-xs font-bold uppercase tracking-wide text-medical md:grid-cols-[1.4fr_1fr_1fr_1fr]">
              <span>Үзүүлэлт</span>
              <span>Хариу</span>
              <span className="hidden md:block">Нэгж</span>
              <span>Хэвийн хэмжээ</span>
            </div>
            {values.map((item, index) => (
              <div key={`${item.name}-${index}`} className="grid grid-cols-[1.2fr_1fr_1fr] gap-2 border-t border-sky-100 px-4 py-3 text-sm text-slate-600 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
                <b className="text-navy">{item.name || "-"}</b>
                <span>{item.value || "-"}</span>
                <span className="hidden md:block">{item.unit || "-"}</span>
                <span>{item.range || "-"}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-sky-100 bg-white p-4">
            <h3 className="font-bold text-navy">Эмчийн тайлбар</h3>
            <p className="mt-2 leading-6 text-slate-600">{result.doctorNote || "Тайлбар оруулаагүй байна."}</p>
          </div>
          <div className="mt-5 flex justify-end">
            {result.fileUrl ? (
              <a href={result.fileUrl} download={result.fileName} className="inline-flex items-center gap-2 rounded-full bg-medical px-5 py-3 text-sm font-bold text-white hover:bg-sky-600"><Download size={16} />Татах</a>
            ) : (
              <button type="button" className="inline-flex items-center gap-2 rounded-full bg-medical px-5 py-3 text-sm font-bold text-white hover:bg-sky-600" onClick={() => downloadPreparedLabResult(result)}><Download size={16} />Татах</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDateOnly(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function downloadPreparedLabResult(result: LabResultRow) {
  const blob = createLabResultPdfBlob(result);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFileName(result.title)}-${result.code}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createLabResultPdfBlob(result: LabResultRow) {
  const rows = (result.values && result.values.length > 0 ? result.values : [{ name: "Ерөнхий үзүүлэлт", value: result.status, unit: "", range: "Бэлэн" }])
    .map((item) => [item.name || "-", item.value || "-", item.unit || "-", item.range || "-"]);
  const canvas = document.createElement("canvas");
  canvas.width = 1240;
  canvas.height = 1754;
  const context = canvas.getContext("2d");
  if (!context) return new Blob([], { type: "application/pdf" });

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#0b5b86";
  context.fillRect(0, 0, canvas.width, 150);
  context.fillStyle = "#ffffff";
  context.font = "bold 42px Arial, sans-serif";
  context.fillText("MediConnect", 70, 65);
  context.font = "bold 34px Arial, sans-serif";
  context.fillText("Шинжилгээний хариу", 70, 115);

  let y = 215;
  context.fillStyle = "#073b5c";
  context.font = "bold 34px Arial, sans-serif";
  y = drawWrappedText(context, result.title, 70, y, 1080, 42);
  context.font = "24px Arial, sans-serif";
  context.fillStyle = "#475569";
  y += 22;
  y = drawWrappedText(context, `Код: ${result.code}`, 70, y, 1080, 34);
  y = drawWrappedText(context, `Эмнэлэг/Лаборатори: ${result.labName}`, 70, y + 4, 1080, 34);
  y = drawWrappedText(context, `Огноо: ${formatDateOnly(result.issuedAt)}    Статус: ${result.status}`, 70, y + 4, 1080, 34);

  y += 40;
  context.fillStyle = "#e6f7fd";
  context.fillRect(70, y, 1100, 54);
  context.fillStyle = "#0b5b86";
  context.font = "bold 22px Arial, sans-serif";
  context.fillText("Үзүүлэлт", 95, y + 35);
  context.fillText("Хариу", 500, y + 35);
  context.fillText("Нэгж", 720, y + 35);
  context.fillText("Хэвийн хэмжээ", 900, y + 35);
  y += 54;

  context.font = "22px Arial, sans-serif";
  context.fillStyle = "#334155";
  rows.forEach((row, index) => {
    const rowY = y + index * 52;
    context.fillStyle = index % 2 === 0 ? "#ffffff" : "#f8fafc";
    context.fillRect(70, rowY, 1100, 52);
    context.strokeStyle = "#dbeafe";
    context.strokeRect(70, rowY, 1100, 52);
    context.fillStyle = "#334155";
    context.fillText(row[0], 95, rowY + 34);
    context.fillText(row[1], 500, rowY + 34);
    context.fillText(row[2], 720, rowY + 34);
    context.fillText(row[3], 900, rowY + 34);
  });
  y += rows.length * 52 + 70;

  context.fillStyle = "#073b5c";
  context.font = "bold 28px Arial, sans-serif";
  context.fillText("Эмчийн тайлбар", 70, y);
  context.fillStyle = "#475569";
  context.font = "24px Arial, sans-serif";
  drawWrappedText(context, result.doctorNote || "Тайлбар оруулаагүй байна.", 70, y + 42, 1080, 34);

  context.fillStyle = "#94a3b8";
  context.font = "20px Arial, sans-serif";
  context.fillText("Энэ бол MediConnect demo PDF report.", 70, 1685);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const imageBytes = base64ToBytes(dataUrl.split(",")[1] || "");
  return buildSingleImagePdf(imageBytes, canvas.width, canvas.height);
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").slice(0, 80) || "lab-result";
}

function drawWrappedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;
  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  });
  if (line) {
    context.fillText(line, x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

function base64ToBytes(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function buildSingleImagePdf(imageBytes: Uint8Array, width: number, height: number) {
  const encoder = new TextEncoder();
  const chunks: BlobPart[] = [];
  const offsets: number[] = [];
  let length = 0;
  function pushText(text: string) {
    const bytes = encoder.encode(text);
    chunks.push(bytes);
    length += bytes.length;
  }
  function pushBytes(bytes: Uint8Array) {
    chunks.push(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    length += bytes.length;
  }
  function object(id: number, body: () => void) {
    offsets[id] = length;
    pushText(`${id} 0 obj\n`);
    body();
    pushText("\nendobj\n");
  }

  pushText("%PDF-1.4\n");
  object(1, () => pushText("<< /Type /Catalog /Pages 2 0 R >>"));
  object(2, () => pushText("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"));
  object(3, () => pushText("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>"));
  object(4, () => {
    pushText(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`);
    pushBytes(imageBytes);
    pushText("\nendstream");
  });
  const content = "q\n595 0 0 842 0 0 cm\n/Im0 Do\nQ\n";
  object(5, () => pushText(`<< /Length ${content.length} >>\nstream\n${content}endstream`));
  const xrefOffset = length;
  pushText("xref\n0 6\n0000000000 65535 f \n");
  for (let id = 1; id <= 5; id += 1) pushText(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  pushText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return new Blob(chunks, { type: "application/pdf" });
}
