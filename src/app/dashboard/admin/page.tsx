"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, CalendarClock, Coins, Search, Stethoscope, UserRound, UsersRound } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { api } from "@/services/api";

type AdminData = {
  summary: {
    totalUsers: number;
    totalDoctors: number;
    totalPatients: number;
    totalAppointmentsToday: number;
    doctorAppointmentsToday: number;
    hospitalAppointmentsToday: number;
    revenueToday: number;
  };
  users: Array<{
    id: string;
    firstName: string;
    lastName?: string | null;
    email: string;
    phone?: string | null;
    role: "PATIENT" | "DOCTOR" | "ADMIN";
    isActive: boolean;
    createdAt: string;
  }>;
  doctors: Array<{
    id: string;
    name: string;
    specialty: string;
    gender?: string | null;
    phone?: string | null;
    email: string;
    online: boolean;
    totalAppointments: number;
    todayAppointments: number;
  }>;
  todayAppointments: Array<{
    id: string;
    patientName: string;
    doctorName: string;
    hospitalName?: string;
    type: string;
    scheduledAt: string;
    paymentStatus: string;
    status: string;
    price: number;
  }>;
};

const emptyData: AdminData = {
  summary: {
    totalUsers: 0,
    totalDoctors: 0,
    totalPatients: 0,
    totalAppointmentsToday: 0,
    doctorAppointmentsToday: 0,
    hospitalAppointmentsToday: 0,
    revenueToday: 0,
  },
  users: [],
  doctors: [],
  todayAppointments: [],
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/admin")
      .then((response) => setData(response.data.data as AdminData))
      .catch(() => setData(emptyData))
      .finally(() => setLoading(false));
  }, []);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredUsers = useMemo(() => {
    if (!normalizedSearch) return data.users;
    return data.users.filter((user) => `${user.lastName || ""} ${user.firstName} ${user.email} ${user.phone || ""} ${user.role}`.toLowerCase().includes(normalizedSearch));
  }, [data.users, normalizedSearch]);
  const filteredDoctors = useMemo(() => {
    if (!normalizedSearch) return data.doctors;
    return data.doctors.filter((doctor) => `${doctor.name} ${doctor.specialty} ${doctor.email} ${doctor.phone || ""}`.toLowerCase().includes(normalizedSearch));
  }, [data.doctors, normalizedSearch]);

  const cards = [
    { label: "Нийт хэрэглэгч", value: data.summary.totalUsers, icon: UsersRound },
    { label: "Нийт эмч", value: data.summary.totalDoctors, icon: Stethoscope },
    { label: "Нийт өвчтөн", value: data.summary.totalPatients, icon: UserRound },
    { label: "Өнөөдрийн нийт захиалга", value: data.summary.totalAppointmentsToday, icon: CalendarClock },
    { label: "Өнөөдрийн эмчийн захиалга", value: data.summary.doctorAppointmentsToday, icon: Activity },
    { label: "Өнөөдрийн эмнэлгийн захиалга", value: data.summary.hospitalAppointmentsToday, icon: CalendarClock },
    { label: "Өнөөдрийн орлого", value: formatMoney(data.summary.revenueToday), icon: Coins },
  ];

  return (
    <section className="min-h-screen bg-[#f2faf6] px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[34px] bg-gradient-to-br from-[#237b68] via-[#2f917b] to-[#8fd8bf] p-6 text-white shadow-[0_20px_60px_rgba(25,105,89,0.22)]">
          <p className="text-sm font-bold text-emerald-50">MediConnect Admin</p>
          <h1 className="mt-2 text-3xl font-extrabold">Админы самбар</h1>
          <p className="mt-2 text-sm font-semibold text-emerald-50">Хэрэглэгч, эмч, захиалга, орлогын бодит DB мэдээлэл.</p>
        </div>

        <div className="mt-6 flex max-w-xl items-center rounded-full border border-emerald-100 bg-white px-4 py-3 shadow-soft">
          <Search size={18} className="text-medical" />
          <input className="ml-3 w-full bg-transparent text-sm outline-none" placeholder="Хэрэглэгч, эмч, имэйл, утас хайх..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

        {loading ? (
          <Card className="mt-6 p-6 text-sm font-semibold text-slate-500">Админы мэдээлэл ачаалж байна...</Card>
        ) : (
          <div className="mt-6 grid gap-6">
            <AdminTable title="Хэрэглэгчид" columns={["Нэр", "И-мэйл", "Role", "Утас", "Бүртгэсэн", "Төлөв"]}>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-t border-emerald-50">
                  <Td>{`${user.lastName || ""} ${user.firstName}`.trim()}</Td>
                  <Td>{user.email}</Td>
                  <Td><Badge>{user.role}</Badge></Td>
                  <Td>{user.phone || "-"}</Td>
                  <Td>{formatDate(user.createdAt)}</Td>
                  <Td><Badge tone={user.isActive ? "green" : "gray"}>{user.isActive ? "ACTIVE" : "INACTIVE"}</Badge></Td>
                </tr>
              ))}
              {filteredUsers.length === 0 && <EmptyRow colSpan={6} text="Хэрэглэгч олдсонгүй" />}
            </AdminTable>

            <AdminTable title="Эмч нар" columns={["Эмч", "Мэргэжил", "Хүйс", "Утас / И-мэйл", "Төлөв", "Нийт цаг", "Өнөөдөр"]}>
              {filteredDoctors.map((doctor) => (
                <tr key={doctor.id} className="border-t border-emerald-50">
                  <Td>{doctor.name}</Td>
                  <Td>{doctor.specialty}</Td>
                  <Td>{doctor.gender || "-"}</Td>
                  <Td>{doctor.phone || doctor.email}</Td>
                  <Td><Badge tone={doctor.online ? "green" : "gray"}>{doctor.online ? "Active" : "Offline"}</Badge></Td>
                  <Td>{doctor.totalAppointments}</Td>
                  <Td>{doctor.todayAppointments}</Td>
                </tr>
              ))}
              {filteredDoctors.length === 0 && <EmptyRow colSpan={7} text="Эмч олдсонгүй" />}
            </AdminTable>

            <AdminTable title="Өнөөдрийн захиалгууд" columns={["Өвчтөн", "Эмч", "Эмнэлэг", "Төрөл", "Цаг", "Төлбөр", "Төлөв"]}>
              {data.todayAppointments.map((appointment) => (
                <tr key={appointment.id} className="border-t border-emerald-50">
                  <Td>{appointment.patientName}</Td>
                  <Td>{appointment.doctorName}</Td>
                  <Td>{appointment.hospitalName || "-"}</Td>
                  <Td><Badge>{getAppointmentTypeLabel(appointment.type, appointment.hospitalName)}</Badge></Td>
                  <Td>{formatTime(appointment.scheduledAt)}</Td>
                  <Td><Badge tone={appointment.paymentStatus === "PAID" ? "green" : "gray"}>{appointment.paymentStatus === "PAID" ? "Төлбөр төлсөн" : appointment.paymentStatus}</Badge></Td>
                  <Td>{appointment.status}</Td>
                </tr>
              ))}
              {data.todayAppointments.length === 0 && <EmptyRow colSpan={7} text="Өнөөдрийн захиалга алга" />}
            </AdminTable>
          </div>
        )}
      </div>
    </section>
  );
}

function AdminTable({ title, columns, children }: { title: string; columns: string[]; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-emerald-100 px-5 py-4">
        <h2 className="text-lg font-extrabold text-navy">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-emerald-50 text-xs uppercase text-slate-500">
            <tr>{columns.map((column) => <th key={column} className="px-4 py-3 font-extrabold">{column}</th>)}</tr>
          </thead>
          <tbody className="bg-white text-slate-700">{children}</tbody>
        </table>
      </div>
    </Card>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 font-semibold">{children}</td>;
}

function Badge({ children, tone = "blue" }: { children: React.ReactNode; tone?: "blue" | "green" | "gray" }) {
  const styles = {
    blue: "bg-cyanSoft text-medical",
    green: "bg-emerald-50 text-emerald-700",
    gray: "bg-slate-100 text-slate-500",
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-extrabold ${styles[tone]}`}>{children}</span>;
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return <tr><td colSpan={colSpan} className="px-4 py-8 text-center font-bold text-slate-400">{text}</td></tr>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime(value: string) {
  const date = new Date(value);
  return `${formatDate(value)} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatMoney(value: number) {
  return `${Math.round(value).toLocaleString("en-US")}₮`;
}

function getAppointmentTypeLabel(type: string, hospitalName?: string) {
  if (type === "ONLINE") return "Онлайн";
  if (hospitalName) return "Эмнэлэг";
  return "Биечлэн";
}
