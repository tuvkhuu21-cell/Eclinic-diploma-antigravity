"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, CircleOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { appointmentSpecialties } from "@/components/appointments/specialtyOptions";
import { api } from "@/services/api";

type DoctorProfileResponse = {
  specialty: string;
  bio?: string;
  experience: number;
  fee: number;
  gender?: string | null;
  online: boolean;
  supportsOnline?: boolean;
  supportsInPerson?: boolean;
  availableDays?: number[];
  hospital?: { name: string } | null;
  user: {
    email: string;
    firstName: string;
    lastName?: string;
    phone?: string;
  };
};

type AlertState = { type: "success" | "error"; text: string };
const weekDays = [
  { value: 1, label: "Даваа" },
  { value: 2, label: "Мягмар" },
  { value: 3, label: "Лхагва" },
  { value: 4, label: "Пүрэв" },
  { value: 5, label: "Баасан" },
  { value: 6, label: "Бямба" },
  { value: 0, label: "Ням" },
];
const defaultAvailableDays = [1, 2, 3, 4, 5];

export function DoctorProfileForm() {
  const [form, setForm] = useState({
    lastName: "",
    firstName: "",
    phone: "",
    email: "",
    specialty: appointmentSpecialties[0] || "Дотор",
    experience: "",
    fee: "",
    gender: "Эмэгтэй",
    hospital: "",
    bio: "",
    online: false,
    supportsOnline: true,
    supportsInPerson: false,
    availableDays: defaultAvailableDays,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);

  useEffect(() => {
    api.get("/doctors/me")
      .then((response) => {
        const profile = response.data.data as DoctorProfileResponse | null;
        if (!profile) return;
        setForm({
          lastName: profile.user.lastName || "",
          firstName: profile.user.firstName || "",
          phone: profile.user.phone || "",
          email: profile.user.email || "",
          specialty: profile.specialty,
          experience: String(profile.experience),
          fee: String(profile.fee),
          gender: profile.gender || "Эмэгтэй",
          hospital: profile.hospital?.name || "",
          bio: profile.bio || "",
          online: profile.online,
          supportsOnline: profile.supportsOnline ?? profile.online,
          supportsInPerson: profile.supportsInPerson ?? false,
          availableDays: profile.availableDays?.length ? profile.availableDays : defaultAvailableDays,
        });
      })
      .catch(() => setAlert({ type: "error", text: "Профайл ачаалж чадсангүй" }))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAlert(null);
    try {
      setSaving(true);
      await api.patch("/doctors/me", {
        ...form,
        experience: Number(form.experience),
        fee: Number(form.fee),
      });
      setAlert({ type: "success", text: "Профайл амжилттай хадгалагдлаа" });
    } catch {
      setAlert({ type: "error", text: "Профайл хадгалахад алдаа гарлаа" });
    } finally {
      setSaving(false);
    }
  }

  function patch(key: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleAvailableDay(day: number) {
    setForm((current) => {
      const days = current.availableDays.includes(day)
        ? current.availableDays.filter((value) => value !== day)
        : [...current.availableDays, day].sort((a, b) => a - b);
      return { ...current, availableDays: days.length ? days : current.availableDays };
    });
  }

  async function toggleOnlineStatus() {
    const nextOnline = !form.online;
    setForm((current) => ({ ...current, online: nextOnline }));
    setStatusSaving(true);
    setAlert(null);
    try {
      await api.patch("/doctors/me", {
        ...form,
        online: nextOnline,
        experience: Number(form.experience),
        fee: Number(form.fee),
      });
      setAlert({ type: "success", text: nextOnline ? "Active төлөв хадгалагдлаа" : "Offline төлөв хадгалагдлаа" });
    } catch {
      setForm((current) => ({ ...current, online: !nextOnline }));
      setAlert({ type: "error", text: "Онлайн төлөв хадгалахад алдаа гарлаа" });
    } finally {
      setStatusSaving(false);
    }
  }

  if (loading) return <Card className="p-5 text-sm font-semibold text-slate-500">Профайл ачаалж байна...</Card>;

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy">Хувийн мэдээлэл</h2>
          <p className="mt-1 text-sm text-slate-500">Энд хадгалсан мэдээлэл өвчтөнд харагдана.</p>
        </div>
        <button
          type="button"
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${form.online ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
          onClick={toggleOnlineStatus}
          disabled={saving || statusSaving}
        >
          {form.online ? <CheckCircle2 size={16} /> : <CircleOff size={16} />}
          {statusSaving ? "Хадгалж байна..." : form.online ? "Active" : "Offline"}
        </button>
      </div>
      {alert && <div className={`mt-4 rounded-lg border px-4 py-3 text-sm font-semibold ${alert.type === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800"}`}>{alert.text}</div>}
      <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <Input placeholder="Овог" value={form.lastName} onChange={(event) => patch("lastName", event.target.value)} disabled={saving} />
        <Input placeholder="Нэр" value={form.firstName} onChange={(event) => patch("firstName", event.target.value)} disabled={saving} />
        <Input inputMode="tel" placeholder="Утас" value={form.phone} onChange={(event) => patch("phone", event.target.value)} disabled={saving} />
        <Input placeholder="И-мэйл" value={form.email} disabled readOnly />
        <select className="h-11 rounded-lg border border-slate-200 px-4 text-sm outline-none transition focus:border-medical focus:ring-4 focus:ring-sky-100" value={form.gender} onChange={(event) => patch("gender", event.target.value)} disabled={saving}>
          <option>Эрэгтэй</option>
          <option>Эмэгтэй</option>
        </select>
        <select className="h-11 rounded-lg border border-slate-200 px-4 text-sm outline-none transition focus:border-medical focus:ring-4 focus:ring-sky-100" value={form.specialty} onChange={(event) => patch("specialty", event.target.value)} disabled={saving}>
          {appointmentSpecialties.map((specialty) => <option key={specialty}>{specialty}</option>)}
        </select>
        <Input inputMode="numeric" placeholder="Ажилласан жил" value={form.experience} onChange={(event) => patch("experience", event.target.value)} disabled={saving} />
        <Input inputMode="numeric" placeholder="Үзлэгийн төлбөр" value={form.fee} onChange={(event) => patch("fee", event.target.value)} disabled={saving} />
        <Input placeholder="Тасаг / Эмнэлэг" value={form.hospital} onChange={(event) => patch("hospital", event.target.value)} disabled={saving} />
        <Input placeholder="Лицензийн дугаар" disabled value="Профайл баталгаажуулалтын дараа нэмэгдэнэ" />
        <Input placeholder="Ажлын цаг" disabled value="09:00 - 18:00" />
        <Input placeholder="Боловсрол" disabled value="Профайл дээрх боловсролын хэсэгт харагдана" />
        <Input placeholder="Сертификат / туршлага" disabled value={`${form.experience || 0} жил туршлага`} />
        <label className="flex h-11 items-center gap-3 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700">
          <input type="checkbox" className="h-4 w-4 accent-medical" checked={form.supportsOnline} onChange={(event) => patch("supportsOnline", event.target.checked)} disabled={saving} />
          Үйлчилгээний төрөл: Онлайн
        </label>
        <label className="flex h-11 items-center gap-3 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700">
          <input type="checkbox" className="h-4 w-4 accent-medical" checked={form.supportsInPerson} onChange={(event) => patch("supportsInPerson", event.target.checked)} disabled={saving} />
          Үйлчилгээний төрөл: Биечлэн
        </label>
        <div className="md:col-span-2 rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-bold text-navy">Онлайн цаг захиалга авах гараг</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {weekDays.map((day) => (
              <button
                key={day.value}
                type="button"
                className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${form.availableDays.includes(day.value) ? "border-medical bg-cyanSoft text-medical" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                onClick={() => toggleAvailableDay(day.value)}
                disabled={saving}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
        <textarea className="min-h-28 rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-medical focus:ring-4 focus:ring-sky-100 md:col-span-2" placeholder="Танилцуулга" value={form.bio} onChange={(event) => patch("bio", event.target.value)} disabled={saving} />
        <Button className="md:col-span-2" disabled={saving}>{saving ? "Хадгалж байна..." : "Хадгалах"}</Button>
      </form>
    </Card>
  );
}
