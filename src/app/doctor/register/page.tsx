"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { appointmentSpecialties } from "@/components/appointments/specialtyOptions";
import { api } from "@/services/api";
import { AuthUser, useAuthStore } from "@/store/auth.store";

type AlertState = { type: "success" | "error"; text: string };
type HospitalOption = { id: string; name: string; type: string; district: string };

function getAuthPayload(responseData: unknown): { token: string; user: AuthUser } {
  const data = responseData as { data?: { token?: string; user?: AuthUser }; token?: string; user?: AuthUser };
  const payload = data.data || data;
  if (!payload.token || !payload.user?.role) throw new Error("Invalid auth response");
  return { token: payload.token, user: payload.user };
}

export default function DoctorRegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [form, setForm] = useState({
    lastName: "",
    firstName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    specialty: appointmentSpecialties[0] || "Дотор",
    gender: "Эмэгтэй",
    experience: "",
    fee: "",
    hospitalId: "",
    hospital: "",
    bio: "",
    supportsOnline: "true",
    supportsInPerson: "false",
  });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);

  useEffect(() => {
    api.get("/hospitals")
      .then((response) => setHospitals((response.data.data || []) as HospitalOption[]))
      .catch(() => setHospitals([]));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAlert(null);
    if (form.password !== form.confirmPassword) {
      setAlert({ type: "error", text: "Нууц үг давталт таарахгүй байна" });
      return;
    }
    try {
      setLoading(true);
      const response = await api.post("/doctors/register", {
        ...form,
        experience: Number(form.experience),
        fee: Number(form.fee),
        supportsOnline: form.supportsOnline === "true",
        supportsInPerson: form.supportsInPerson === "true",
      });
      const { token, user } = getAuthPayload(response.data);
      setAuth(token, user);
      setAlert({ type: "success", text: "Эмчийн бүртгэл амжилттай үүслээ" });
      window.setTimeout(() => {
        router.replace("/dashboard/doctor");
        router.refresh();
      }, 500);
    } catch (error) {
      const status = (error as AxiosError).response?.status;
      setAlert({ type: "error", text: status === 409 ? "Энэ и-мэйл бүртгэлтэй байна" : "Мэдээллээ бүрэн шалгана уу" });
    } finally {
      setLoading(false);
    }
  }

  function patch(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-4xl rounded-2xl bg-white p-7 shadow-soft ring-1 ring-sky-100">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Image src="/logo/mediconnect.svg" alt="MediConnect" width={180} height={44} priority />
          <Link href="/doctor/login" className="text-sm font-bold text-medical hover:text-sky-700">Нэвтрэх</Link>
        </div>
        <h1 className="mt-8 text-3xl font-bold text-navy">Эмчээр бүртгүүлэх</h1>
        <p className="mt-2 text-sm text-slate-500">Мэдээллээ бөглөсний дараа таны профайл өвчтөнд харагдана.</p>
        {alert && <AuthAlert {...alert} />}
        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <Input placeholder="Овог" value={form.lastName} onChange={(event) => patch("lastName", event.target.value)} disabled={loading} />
          <Input placeholder="Нэр" value={form.firstName} onChange={(event) => patch("firstName", event.target.value)} disabled={loading} />
          <Input type="email" placeholder="И-мэйл хаяг" value={form.email} onChange={(event) => patch("email", event.target.value)} disabled={loading} />
          <Input inputMode="tel" placeholder="Утасны дугаар" value={form.phone} onChange={(event) => patch("phone", event.target.value)} disabled={loading} />
          <Input type="password" placeholder="Нууц үг" value={form.password} onChange={(event) => patch("password", event.target.value)} disabled={loading} />
          <Input type="password" placeholder="Нууц үг давтах" value={form.confirmPassword} onChange={(event) => patch("confirmPassword", event.target.value)} disabled={loading} />
          <select className="h-11 rounded-lg border border-slate-200 px-4 text-sm outline-none transition focus:border-medical focus:ring-4 focus:ring-sky-100" value={form.specialty} onChange={(event) => patch("specialty", event.target.value)} disabled={loading}>
            {appointmentSpecialties.map((specialty) => <option key={specialty}>{specialty}</option>)}
          </select>
          <select className="h-11 rounded-lg border border-slate-200 px-4 text-sm outline-none transition focus:border-medical focus:ring-4 focus:ring-sky-100" value={form.gender} onChange={(event) => patch("gender", event.target.value)} disabled={loading}>
            <option>Эрэгтэй</option>
            <option>Эмэгтэй</option>
          </select>
          <Input inputMode="numeric" placeholder="Туршлага / жил" value={form.experience} onChange={(event) => patch("experience", event.target.value)} disabled={loading} />
          <Input inputMode="numeric" placeholder="Үзлэгийн төлбөр" value={form.fee} onChange={(event) => patch("fee", event.target.value)} disabled={loading} />
          <select className="h-11 rounded-lg border border-slate-200 px-4 text-sm outline-none transition focus:border-medical focus:ring-4 focus:ring-sky-100" value={form.hospitalId} onChange={(event) => {
            const hospital = hospitals.find((item) => item.id === event.target.value);
            patch("hospitalId", event.target.value);
            patch("hospital", hospital?.name || "");
          }} disabled={loading}>
            <option value="">Эмнэлэг сонгох</option>
            {hospitals.map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name} · {hospital.district}</option>)}
          </select>
          <label className="flex h-11 items-center gap-3 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-medical" checked={form.supportsOnline === "true"} onChange={(event) => patch("supportsOnline", event.target.checked ? "true" : "false")} disabled={loading} />
            Онлайн үзлэг авна
          </label>
          <label className="flex h-11 items-center gap-3 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-medical" checked={form.supportsInPerson === "true"} onChange={(event) => patch("supportsInPerson", event.target.checked ? "true" : "false")} disabled={loading} />
            Биечлэн үзлэг авна
          </label>
          <textarea className="min-h-28 rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-medical focus:ring-4 focus:ring-sky-100 md:col-span-2" placeholder="Товч танилцуулга" value={form.bio} onChange={(event) => patch("bio", event.target.value)} disabled={loading} />
          <Button className="md:col-span-2" disabled={loading}>{loading ? "Бүртгэж байна..." : "Бүртгүүлэх"}</Button>
        </form>
      </div>
    </section>
  );
}

function AuthAlert({ type, text }: AlertState) {
  const styles = type === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800";
  return <div className={`mt-5 rounded-lg border px-4 py-3 text-sm font-semibold ${styles}`}>{text}</div>;
}
