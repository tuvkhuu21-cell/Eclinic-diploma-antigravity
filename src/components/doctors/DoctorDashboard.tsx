"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarClock,
  Clock3,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  MonitorPlay,
  Settings,
  Stethoscope,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { NotificationBox } from "@/components/notifications/NotificationBox";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChatBox } from "@/components/chat/ChatBox";
import { DoctorAppointmentList } from "@/components/appointments/DoctorAppointmentList";
import { DoctorProfileForm } from "./DoctorProfileForm";
import { api } from "@/services/api";
import { useAuthStore } from "@/store/auth.store";

type DoctorSection = "dashboard" | "profile" | "appointments" | "online" | "patients" | "chat" | "notifications" | "settings";

type DoctorAppointment = {
  id: string;
  scheduledAt?: string;
  type?: string;
  status?: string;
  paymentStatus?: string;
  price?: number;
  patient?: {
    id?: string;
    dateOfBirth?: string | null;
    gender?: string | null;
    registerNo?: string | null;
    bloodType?: string | null;
    maritalStatus?: string | null;
    heightCm?: number | null;
    weightKg?: number | null;
    bmi?: number | null;
    city?: string | null;
    district?: string | null;
    khoroo?: string | null;
    addressDetail?: string | null;
    emergencyRelation?: string | null;
    emergencyName?: string | null;
    emergencyPhone?: string | null;
    hasAllergy?: boolean | null;
    allergyNote?: string | null;
    hasChronicDisease?: boolean | null;
    chronicDiseaseNote?: string | null;
    hasRegularMedicine?: boolean | null;
    regularMedicineNote?: string | null;
    hasInjury?: boolean | null;
    injuryNote?: string | null;
    hasSurgery?: boolean | null;
    surgeryNote?: string | null;
    smoking?: string | null;
    alcohol?: string | null;
    movement?: string | null;
    food?: string | null;
    user?: {
      id?: string;
      email?: string;
      firstName?: string;
      lastName?: string | null;
      phone?: string | null;
    };
  };
};

const sections: Array<{ key: DoctorSection; label: string; icon: typeof LayoutDashboard }> = [
  { key: "dashboard", label: "Хянах самбар", icon: LayoutDashboard },
  { key: "profile", label: "Хувийн мэдээлэл", icon: UserRound },
  { key: "appointments", label: "Цаг захиалгууд", icon: CalendarClock },
  { key: "online", label: "Онлайн зөвлөгөө", icon: MonitorPlay },
  { key: "patients", label: "Өвчтөнүүд", icon: UsersRound },
  { key: "chat", label: "Чат", icon: MessageCircle },
  { key: "notifications", label: "Мэдэгдэл", icon: Bell },
  { key: "settings", label: "Тохиргоо", icon: Settings },
];

export function DoctorDashboard() {
  const router = useRouter();
  const { hasHydrated, token, role, user, logout } = useAuthStore();
  const [active, setActive] = useState<DoctorSection>("dashboard");
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [online, setOnline] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const activeRole = user?.role || role;
  const isAllowed = activeRole === "DOCTOR" || activeRole === "ADMIN";
  const doctorName = `${user?.lastName || ""} ${user?.firstName || "Эмч"}`.trim();

  const loadDoctorAppointments = useCallback(async () => {
    if (activeRole !== "DOCTOR") return;
    try {
      const response = await api.get("/appointments/doctor");
      setAppointments((response.data.data || []) as DoctorAppointment[]);
    } catch {
      setAppointments([]);
    }
  }, [activeRole]);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("section") as DoctorSection | null;
    if (requested && sections.some((section) => section.key === requested)) setActive(requested);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token) {
      router.replace("/doctor/login");
      return;
    }
    if (activeRole === "PATIENT") {
      router.replace("/patient/home");
    }
  }, [activeRole, hasHydrated, router, token]);

  useEffect(() => {
    if (!hasHydrated || activeRole !== "DOCTOR") return;
    void loadDoctorAppointments();
    api.get("/doctors/me")
      .then((response) => setOnline(Boolean(response.data.data?.online || response.data.data?.isOnline)))
      .catch(() => setOnline(false));
  }, [activeRole, hasHydrated, loadDoctorAppointments]);

  useEffect(() => {
    if (!hasHydrated || activeRole !== "DOCTOR") return;
    if (active === "dashboard" || active === "appointments" || active === "patients") void loadDoctorAppointments();
  }, [active, activeRole, hasHydrated, loadDoctorAppointments]);

  const stats = useMemo(() => {
    const paid = appointments.filter(isPaidAppointment);
    const todayKey = formatDateKey(new Date());
    const monthKey = todayKey.slice(0, 7);
    const today = paid.filter((item) => item.scheduledAt && formatDateKey(new Date(item.scheduledAt)) === todayKey);
    const month = paid.filter((item) => item.scheduledAt && formatDateKey(new Date(item.scheduledAt)).startsWith(monthKey));
    return {
      today: today.length,
      month: month.length,
      todayRevenue: sumRevenue(today),
      totalRevenue: sumRevenue(paid),
    };
  }, [appointments]);

  const paidAppointments = useMemo(() => appointments.filter(isPaidAppointment), [appointments]);
  const todaySchedule = useMemo(() => {
    const todayKey = formatDateKey(new Date());
    return paidAppointments
      .filter((item) => item.scheduledAt && formatDateKey(new Date(item.scheduledAt)) === todayKey)
      .sort((a, b) => new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime());
  }, [paidAppointments]);
  const analytics = useMemo(() => buildAnalytics(paidAppointments), [paidAppointments]);

  async function toggleOnlineStatus() {
    const nextOnline = !online;
    setOnline(nextOnline);
    setSavingStatus(true);
    setStatusMessage("");
    try {
      await api.patch("/doctors/me", { online: nextOnline });
      setStatusMessage(nextOnline ? "Active төлөв хадгалагдлаа. Та яг одоо зөвлөгөөнд харагдана." : "Offline төлөв хадгалагдлаа. Та яг одоо зөвлөгөөнөөс нуугдана.");
    } catch {
      setOnline(!nextOnline);
      setStatusMessage("Төлөв хадгалахад алдаа гарлаа.");
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleLogout() {
    if (activeRole === "DOCTOR") await api.patch("/doctors/me", { online: false }).catch(() => null);
    logout();
    router.replace("/");
    router.refresh();
  }

  if (!hasHydrated || !token || !isAllowed) {
    return <section className="min-h-screen bg-slate-50" />;
  }

  return (
    <section className="min-h-screen bg-[#f2faf6] px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[34px] bg-gradient-to-br from-[#237b68] via-[#2f917b] to-[#8fd8bf] p-6 text-white shadow-[0_20px_60px_rgba(25,105,89,0.22)]">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
                <Stethoscope size={14} /> Doctor workspace
              </p>
              <h1 className="mt-3 text-3xl font-extrabold">Сайн байна уу, Dr. {doctorName}</h1>
              <p className="mt-2 text-sm font-semibold text-cyan-50">Цаг захиалга, өвчтөн, онлайн зөвлөгөө, чат, мэдэгдлээ нэг дор удирдана.</p>
            </div>
            <button
              type="button"
              className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-extrabold shadow-sm transition ${online ? "bg-emerald-50 text-emerald-700" : "bg-white/90 text-slate-500"}`}
              onClick={toggleOnlineStatus}
              disabled={savingStatus || activeRole !== "DOCTOR"}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-500" : "bg-slate-400"}`} />
              {savingStatus ? "Хадгалж байна..." : online ? "Active" : "Offline"}
            </button>
          </div>
          {statusMessage && <p className="mt-4 rounded-2xl bg-white/15 px-4 py-3 text-sm font-bold text-white">{statusMessage}</p>}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="h-fit rounded-3xl border border-emerald-100 bg-white p-4 shadow-soft">
            <div className="grid gap-2">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.key}
                    type="button"
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${active === section.key ? "bg-cyanSoft text-medical" : "text-slate-600 hover:bg-emerald-50 hover:text-medical"}`}
                    onClick={() => setActive(section.key)}
                  >
                    <Icon size={18} />
                    {section.label}
                  </button>
                );
              })}
              <button type="button" className="mt-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold text-slate-600 transition hover:bg-rose-50 hover:text-rose-600" onClick={handleLogout}>
                <LogOut size={18} />
                Системээс гарах
              </button>
            </div>
          </aside>

          <main>
            {active === "dashboard" && (
              <DoctorHomePanel
                stats={stats}
                online={online}
                onProfile={() => setActive("profile")}
                onAppointments={() => setActive("appointments")}
                onChat={() => setActive("chat")}
                onToggleOnline={toggleOnlineStatus}
                savingStatus={savingStatus}
                todaySchedule={todaySchedule}
                analytics={analytics}
              />
            )}
            {active === "profile" && <DoctorProfileForm />}
            {active === "appointments" && <DoctorAppointmentList />}
            {active === "online" && <DoctorOnlinePanel online={online} />}
            {active === "patients" && <DoctorPatientsPanel appointments={paidAppointments} />}
            {active === "chat" && <ChatBox />}
            {active === "notifications" && <NotificationBox />}
            {active === "settings" && <DoctorSettingsPanel />}
          </main>
        </div>
      </div>
    </section>
  );
}

function DoctorHomePanel({
  stats,
  online,
  onProfile,
  onAppointments,
  onChat,
  onToggleOnline,
  savingStatus,
  todaySchedule,
  analytics,
}: {
  stats: { today: number; month: number; todayRevenue: number; totalRevenue: number };
  online: boolean;
  onProfile: () => void;
  onAppointments: () => void;
  onChat: () => void;
  onToggleOnline: () => void;
  savingStatus: boolean;
  todaySchedule: DoctorAppointment[];
  analytics: Array<{ date: string; count: number; revenue: number }>;
}) {
  const cards = [
    { label: "Өнөөдрийн үзлэг", value: String(stats.today), icon: CalendarClock },
    { label: "Энэ сарын үзлэг", value: String(stats.month), icon: UsersRound },
    { label: "Өнөөдрийн орлого", value: formatMoney(stats.todayRevenue), icon: MonitorPlay },
    { label: "Нийт орлого", value: formatMoney(stats.totalRevenue), icon: Bell },
  ];

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-500">{card.label}</p>
                  <p className="mt-2 text-2xl font-extrabold text-navy">{card.value}</p>
                </div>
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cyanSoft text-medical">
                  <Icon size={22} />
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold text-navy">Өнөөдрийн цагийн хуваарь</h2>
            <Button type="button" variant="outline" onClick={onAppointments}>Цагийн хуваарь харах</Button>
          </div>
          <div className="mt-4 grid gap-3">
            {todaySchedule.map((appointment) => (
              <article key={appointment.id} className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-bold text-navy">{getPatientName(appointment)}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{appointment.scheduledAt ? formatTime(new Date(appointment.scheduledAt)) : "--:--"} · {appointment.type === "ONLINE" ? "Онлайн" : "Биечлэн"}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">Төлбөр төлсөн</span>
                  <span className="rounded-full bg-white px-3 py-1.5 text-medical">{appointment.status || "CONFIRMED"}</span>
                </div>
              </article>
            ))}
            {todaySchedule.length === 0 && <p className="rounded-2xl border border-dashed border-emerald-100 bg-emerald-50/60 p-5 text-sm font-semibold text-slate-600">Өнөөдрийн төлбөр төлөгдсөн цаг одоогоор алга.</p>}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-xl font-extrabold text-navy">Quick actions</h2>
          <div className="mt-4 grid gap-3">
            <Button type="button" variant="outline" onClick={onProfile}>Профайл засах</Button>
            <Button type="button" variant={online ? "outline" : "primary"} onClick={onToggleOnline} disabled={savingStatus}>
              {online ? "Онлайн зөвлөгөө унтраах" : "Онлайн зөвлөгөө асаах"}
            </Button>
            <Button type="button" variant="outline" onClick={onAppointments}>Цагийн хуваарь харах</Button>
            <Button type="button" variant="outline" onClick={onChat}>Чат нээх</Button>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <AnalyticsChart title="Өдөр бүрийн үзлэг" data={analytics} valueKey="count" suffix="" />
        <AnalyticsChart title="Өдөр бүрийн орлого" data={analytics} valueKey="revenue" suffix="₮" />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <InfoPanel title="Онлайн зөвлөгөөний хүсэлтүүд" text="Active төлөвтэй үед өвчтөнүүд шууд зөвлөгөөний урсгалаар таныг сонгоно." />
        <InfoPanel title="Сүүлийн чат" text="Төлбөр төлөгдсөн онлайн цагийн дараа үүссэн өвчтөнүүдийн чат эндээс нээгдэнэ." />
        <InfoPanel title="Миний өвчтөнүүд" text="Таны цаг захиалсан өвчтөнүүд болон өмнөх үзлэгүүдийн жагсаалт энд харагдана." />
      </div>
    </div>
  );
}

function InfoPanel({ title, text }: { title: string; text: string }) {
  return (
    <Card className="p-5">
      <h3 className="font-extrabold text-navy">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{text}</p>
    </Card>
  );
}

function AnalyticsChart({ title, data, valueKey, suffix }: { title: string; data: Array<{ date: string; count: number; revenue: number }>; valueKey: "count" | "revenue"; suffix: string }) {
  const maxValue = Math.max(...data.map((item) => item[valueKey]), 1);
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-extrabold text-navy">{title}</h3>
        <span className="rounded-full bg-cyanSoft px-3 py-1 text-xs font-bold text-medical">Сүүлийн 7 өдөр</span>
      </div>
      <div className="mt-5 flex h-52 items-end gap-3">
        {data.map((item) => {
          const value = item[valueKey];
          const height = Math.max(10, Math.round((value / maxValue) * 100));
          return (
            <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-36 w-full items-end rounded-t-2xl bg-emerald-50 px-1">
                <div className="w-full rounded-t-2xl bg-gradient-to-t from-[#237b68] to-[#8fd8bf] transition-all" style={{ height: `${height}%` }} title={`${value}${suffix}`} />
              </div>
              <p className="text-[11px] font-bold text-slate-500">{item.date.slice(5).replace("-", ".")}</p>
              <p className="truncate text-xs font-extrabold text-navy">{suffix ? formatMoney(value) : value}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function DoctorPatientsPanel({ appointments }: { appointments: DoctorAppointment[] }) {
  const [selectedPatient, setSelectedPatient] = useState<DoctorAppointment | null>(null);
  const patients = useMemo(() => {
    const byPatient = new Map<string, DoctorAppointment>();
    appointments
      .filter((appointment) => appointment.patient?.id || appointment.patient?.user?.id)
      .forEach((appointment) => {
        const key = appointment.patient?.id || appointment.patient?.user?.id || appointment.id;
        const current = byPatient.get(key);
        if (!current || new Date(appointment.scheduledAt || 0).getTime() > new Date(current.scheduledAt || 0).getTime()) byPatient.set(key, appointment);
      });
    return Array.from(byPatient.values()).sort((left, right) => new Date(right.scheduledAt || 0).getTime() - new Date(left.scheduledAt || 0).getTime());
  }, [appointments]);

  return (
    <>
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-navy">Өвчтөнүүд</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Төлбөр төлсөн цаг захиалгатай өвчтөнүүд энд харагдана.</p>
          </div>
          <span className="rounded-full bg-cyanSoft px-3 py-1 text-xs font-bold text-medical">{patients.length} өвчтөн</span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {patients.map((appointment) => {
            const patient = appointment.patient;
            const name = getPatientName(appointment);
            return (
              <button key={patient?.id || appointment.id} type="button" className="rounded-2xl border border-emerald-100 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-medical hover:bg-cyanSoft hover:shadow-soft" onClick={() => setSelectedPatient(appointment)}>
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-cyanSoft text-sm font-black text-medical">{name.slice(0, 2)}</div>
                  <div className="min-w-0">
                    <h3 className="truncate font-extrabold text-navy">{name}</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{patient?.user?.phone || patient?.user?.email || "Холбоо барих мэдээлэл алга"}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-1 text-xs font-semibold text-slate-600">
                  <p>Сүүлийн цаг: {appointment.scheduledAt ? formatDateTime(new Date(appointment.scheduledAt)) : "Огноо алга"}</p>
                  <p>{appointment.type === "ONLINE" ? "Онлайн зөвлөгөө" : "Биечлэн үзүүлэх"} · {appointment.status || "CONFIRMED"}</p>
                </div>
              </button>
            );
          })}
          {patients.length === 0 && (
            <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-emerald-100 bg-emerald-50/60 text-center md:col-span-2">
              <div>
                <UsersRound className="mx-auto text-medical" size={34} />
                <p className="mt-3 font-bold text-navy">Төлбөр төлсөн өвчтөн одоогоор алга.</p>
              </div>
            </div>
          )}
        </div>
      </Card>
      <PatientInfoModal appointment={selectedPatient} onClose={() => setSelectedPatient(null)} />
    </>
  );
}

function DoctorOnlinePanel({ online }: { online: boolean }) {
  return <Card className="p-5"><p className="font-bold text-navy">Онлайн зөвлөгөө</p><p className="mt-2 text-sm text-slate-600">Одоогийн төлөв: <span className={online ? "font-bold text-emerald-700" : "font-bold text-slate-500"}>{online ? "Active" : "Offline"}</span>. Active үед өвчтөнүүд “Яг одоо зөвлөгөө авах” урсгалаар таныг сонгож болно.</p></Card>;
}

function DoctorSettingsPanel() {
  return <Card className="p-5"><p className="font-bold text-navy">Тохиргоо</p><p className="mt-2 text-sm text-slate-600">Эмчийн мэдэгдэл, профайл, системийн тохиргоо энд нэмэгдэнэ.</p></Card>;
}

function PatientInfoModal({ appointment, onClose }: { appointment: DoctorAppointment | null; onClose: () => void }) {
  useEffect(() => {
    if (!appointment) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [appointment]);

  if (!appointment?.patient) return null;
  const patient = appointment.patient;
  const name = getPatientName(appointment);

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-900/45 px-4 py-6 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="max-h-[calc(100vh-3rem)] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-[0_24px_80px_rgba(25,105,89,0.25)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start gap-4 bg-gradient-to-br from-[#237b68] to-[#8fd8bf] p-6 text-white">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white text-lg font-black text-medical">{name.slice(0, 2)}</div>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-extrabold">{name}</h2>
            <p className="mt-1 text-sm font-semibold text-emerald-50">{patient.user?.phone || patient.user?.email || "Холбоо барих мэдээлэл алга"}</p>
            <p className="mt-2 text-xs font-bold text-white/80">Сүүлийн цаг: {appointment.scheduledAt ? formatDateTime(new Date(appointment.scheduledAt)) : "Огноо алга"}</p>
          </div>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 transition hover:bg-white/25" onClick={onClose} aria-label="Close patient info">
            <X size={18} />
          </button>
        </div>
        <div className="patient-modal-scroll max-h-[70vh] overflow-y-auto p-6">
          <div className="grid gap-5 lg:grid-cols-3">
            <PatientInfoSection title="Хувийн мэдээлэл">
              <InfoRow label="Регистр" value={patient.registerNo} />
              <InfoRow label="Хүйс" value={patient.gender} />
              <InfoRow label="Төрсөн огноо" value={patient.dateOfBirth ? formatDateTime(new Date(patient.dateOfBirth)).slice(0, 10) : ""} />
              <InfoRow label="Цусны бүлэг" value={patient.bloodType} />
              <InfoRow label="Гэрлэлтийн байдал" value={patient.maritalStatus} />
              <InfoRow label="Өндөр" value={patient.heightCm ? `${patient.heightCm} см` : ""} />
              <InfoRow label="Жин" value={patient.weightKg ? `${patient.weightKg} кг` : ""} />
              <InfoRow label="БЖИ" value={patient.bmi?.toString()} />
              <InfoRow label="Хаяг" value={[patient.city, patient.district, patient.khoroo, patient.addressDetail].filter(Boolean).join(", ")} />
              <InfoRow label="Яаралтай холбоо" value={[patient.emergencyRelation, patient.emergencyName, patient.emergencyPhone].filter(Boolean).join(" · ")} />
            </PatientInfoSection>
            <PatientInfoSection title="Эрүүл мэндийн мэдээлэл">
              <InfoRow label="Харшил" value={formatBooleanNote(patient.hasAllergy, patient.allergyNote)} />
              <InfoRow label="Архаг өвчин" value={formatBooleanNote(patient.hasChronicDisease, patient.chronicDiseaseNote)} />
              <InfoRow label="Тогтмол эм" value={formatBooleanNote(patient.hasRegularMedicine, patient.regularMedicineNote)} />
              <InfoRow label="Гэмтэл" value={formatBooleanNote(patient.hasInjury, patient.injuryNote)} />
              <InfoRow label="Мэс засал" value={formatBooleanNote(patient.hasSurgery, patient.surgeryNote)} />
            </PatientInfoSection>
            <PatientInfoSection title="Амьдралын хэв маяг">
              <InfoRow label="Тамхи" value={patient.smoking} />
              <InfoRow label="Согтууруулах ундаа" value={patient.alcohol} />
              <InfoRow label="Хөдөлгөөн" value={patient.movement} />
              <InfoRow label="Хооллолт" value={patient.food} />
            </PatientInfoSection>
          </div>
        </div>
      </div>
      <style jsx global>{`
        .patient-modal-scroll { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
        .patient-modal-scroll::-webkit-scrollbar { width: 8px; }
        .patient-modal-scroll::-webkit-scrollbar-thumb { border-radius: 999px; background: #cbd5e1; }
      `}</style>
    </div>
  );
}

function PatientInfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-emerald-100 bg-[#f8fcfa] p-4">
      <h3 className="text-base font-extrabold text-medical">{title}</h3>
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm">
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-navy">{value || "Бүртгээгүй"}</p>
    </div>
  );
}

function isPaidAppointment(appointment: DoctorAppointment) {
  return appointment.paymentStatus === "PAID" || appointment.status === "CONFIRMED" || appointment.status === "COMPLETED";
}

function sumRevenue(appointments: DoctorAppointment[]) {
  return appointments.reduce((sum, appointment) => sum + (appointment.price && appointment.price > 0 ? appointment.price : 30000), 0);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatDateTime(date: Date) {
  if (Number.isNaN(date.getTime())) return "Огноо алга";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}.${month}.${day} ${hours}:${minutes}`;
}

function formatMoney(value: number) {
  return `${Math.round(value).toLocaleString("en-US")}₮`;
}

function getPatientName(appointment: DoctorAppointment) {
  const user = appointment.patient?.user;
  return `${user?.lastName || ""} ${user?.firstName || "Өвчтөн"}`.trim();
}

function formatBooleanNote(value?: boolean | null, note?: string | null) {
  if (value === true) return note ? `Байгаа · ${note}` : "Байгаа";
  if (value === false) return "Байхгүй";
  return note || "Бүртгээгүй";
}

function buildAnalytics(appointments: DoctorAppointment[]) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return formatDateKey(date);
  });
  return days.map((date) => {
    const daily = appointments.filter((appointment) => appointment.scheduledAt && formatDateKey(new Date(appointment.scheduledAt)) === date);
    return { date, count: daily.length, revenue: sumRevenue(daily) };
  });
}
