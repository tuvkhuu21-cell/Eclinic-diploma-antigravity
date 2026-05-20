"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { authService } from "@/services/auth.service";
import { api } from "@/services/api";
import { AuthUser, useAuthStore } from "@/store/auth.store";

type AlertState = { type: "success" | "error"; text: string };

function getAuthPayload(responseData: unknown): { token: string; user: AuthUser } {
  const data = responseData as { data?: { token?: string; user?: AuthUser }; token?: string; user?: AuthUser };
  const payload = data.data || data;
  if (!payload.token || !payload.user?.role) throw new Error("Invalid auth response");
  return { token: payload.token, user: payload.user };
}

export default function DoctorLoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const logout = useAuthStore((state) => state.logout);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAlert(null);
    if (!email.trim() || !password.trim()) {
      setAlert({ type: "error", text: "Мэдээллээ бүрэн оруулна уу" });
      return;
    }

    try {
      setLoading(true);
      const response = await authService.login({ email: email.trim(), password, expectedRole: "DOCTOR" });
      const { token, user } = getAuthPayload(response.data);
      setAuth(token, user);
      await api.patch("/doctors/me", { online: true }).catch(() => null);
      setAlert({ type: "success", text: "Амжилттай нэвтэрлээ" });
      window.setTimeout(() => {
        router.replace("/dashboard/doctor");
        router.refresh();
      }, 400);
    } catch (error) {
      const status = (error as AxiosError).response?.status;
      if (status === 403) logout();
      setAlert({ type: "error", text: status === 401 ? "И-мэйл эсвэл нууц үг буруу байна" : status === 403 ? "Энэ хэсэгт зөвхөн эмч нэвтэрнэ." : "Нэвтрэхэд алдаа гарлаа" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1fr_430px]">
        <div className="relative hidden min-h-[520px] items-center justify-center lg:flex">
          <div className="absolute h-96 w-96 rounded-full bg-cyanSoft" />
          <div className="relative grid h-64 w-64 place-items-center rounded-full bg-white shadow-soft">
            <Image src="/logo/mediconnect.svg" alt="MediConnect" width={210} height={56} priority />
          </div>
        </div>
        <div className="rounded-2xl bg-white p-7 shadow-soft ring-1 ring-sky-100">
          <Image src="/logo/mediconnect.svg" alt="MediConnect" width={170} height={42} className="mb-8 lg:hidden" priority />
          <h1 className="text-3xl font-bold text-navy">Нэвтрэх</h1>
          <p className="mt-2 text-sm text-slate-500">Эмчийн бүртгэлээр системд нэвтэрнэ.</p>
          {alert && <AuthAlert {...alert} />}
          <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
            <Input type="email" placeholder="И-мэйл хаяг / Утасны дугаар" value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} />
            <Input type="password" placeholder="Нууц үг" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} />
            <Button disabled={loading}>{loading ? "Нэвтэрч байна..." : "Нэвтрэх"}</Button>
          </form>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button type="button" className="text-sm font-semibold text-medical hover:text-sky-700">Нууц үгээ мартсан уу?</button>
            <Link href="/doctor/register" className="text-sm font-semibold text-medical hover:text-sky-700">Бүртгүүлэх</Link>
          </div>
          <p className="mt-10 text-xs text-slate-400">2026 © MediConnect. Эмчийн нэвтрэх хэсэг.</p>
        </div>
      </div>
    </section>
  );
}

function AuthAlert({ type, text }: AlertState) {
  const styles = type === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800";
  return <div className={`mt-5 rounded-lg border px-4 py-3 text-sm font-semibold ${styles}`}>{text}</div>;
}
