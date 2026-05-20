"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { authService } from "@/services/auth.service";
import { api } from "@/services/api";
import { AuthRole, AuthUser, useAuthStore } from "@/store/auth.store";

type AlertState = { type: "success" | "error"; text: string };

const dashboardByRole: Record<AuthRole, string> = {
  PATIENT: "/dashboard/patient",
  DOCTOR: "/dashboard/doctor",
  HOSPITAL: "/dashboard/hospital",
  ADMIN: "/dashboard/admin",
};

function getAuthPayload(responseData: unknown): { token: string; user: AuthUser } {
  const data = responseData as { data?: { token?: string; user?: AuthUser }; token?: string; user?: AuthUser };
  const payload = data.data || data;
  if (!payload.token || !payload.user?.role) throw new Error("Invalid auth response");
  return { token: payload.token, user: payload.user };
}

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("registered") === "1") {
      setAlert({ type: "success", text: "Амжилттай бүртгүүллээ. Имэйл, нууц үгээрээ нэвтэрнэ үү." });
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAlert(null);

    if (!email.trim() || !password.trim()) {
      setAlert({ type: "error", text: "Мэдээллээ бүрэн оруулна уу" });
      return;
    }

    try {
      setLoading(true);
      const response = await authService.login({ email: email.trim(), password });
      const { token, user } = getAuthPayload(response.data);
      setAuth(token, user);
      if (user.role === "DOCTOR") await api.patch("/doctors/me", { online: true }).catch(() => null);
      setAlert({ type: "success", text: "Амжилттай нэвтэрлээ" });
      window.setTimeout(() => {
        router.replace(dashboardByRole[user.role]);
        router.refresh();
      }, 500);
    } catch (error) {
      const status = (error as AxiosError).response?.status;
      setAlert({ type: "error", text: status === 401 ? "Имэйл эсвэл нууц үг буруу байна" : "Имэйл эсвэл нууц үг буруу байна" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-md px-4 py-12">
      <Card className="p-6">
        <h1 className="text-3xl font-bold text-navy">Нэвтрэх</h1>
        <p className="mt-2 text-slate-600">Өөрийн эрхээр платформд нэвтэрнэ.</p>
        {alert && <AuthAlert type={alert.type} text={alert.text} />}
        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <Input type="email" placeholder="Имэйл" value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} />
          <Input type="password" placeholder="Нууц үг" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} />
          <Button disabled={loading}>{loading ? "Нэвтэрч байна..." : "Нэвтрэх"}</Button>
        </form>
        <p className="mt-4 text-sm text-slate-600">Шинэ хэрэглэгч үү? <Link className="font-semibold text-medical" href="/auth/register">Бүртгүүлэх</Link></p>
      </Card>
    </section>
  );
}

function AuthAlert({ type, text }: AlertState) {
  const styles = type === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800";
  return <div className={`mt-5 rounded-lg border px-4 py-3 text-sm font-semibold shadow-sm ${styles}`}>{text}</div>;
}
