"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { authService } from "@/services/auth.service";
import { api } from "@/services/api";
import { AuthRole, AuthUser, useAuthStore } from "@/store/auth.store";

type Mode = "login" | "register";
type AlertState = { type: "success" | "error"; text: string };

const dashboardByRole: Record<AuthRole, string> = {
  PATIENT: "/dashboard/patient",
  DOCTOR: "/dashboard/doctor",
  ADMIN: "/dashboard/admin",
};

function getAuthPayload(responseData: unknown): { token: string; user: AuthUser } {
  const data = responseData as { data?: { token?: string; user?: AuthUser }; token?: string; user?: AuthUser };
  const payload = data.data || data;
  if (!payload.token || !payload.user?.role) throw new Error("Invalid auth response");
  return { token: payload.token, user: payload.user };
}

export function PublicAuthModal({ mode, onClose, onModeChange }: { mode: Mode | null; onClose: () => void; onModeChange: (mode: Mode) => void }) {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);

  if (!mode) return null;

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
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
        onClose();
        router.replace(dashboardByRole[user.role]);
        router.refresh();
      }, 400);
    } catch (error) {
      const status = (error as AxiosError).response?.status;
      setAlert({ type: "error", text: status === 401 ? "И-мэйл эсвэл нууц үг буруу байна" : "Нэвтрэхэд алдаа гарлаа" });
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAlert(null);
    if (!firstName.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      setAlert({ type: "error", text: "Нэр, и-мэйл, утас, нууц үгээ бүрэн оруулна уу" });
      return;
    }
    if (password !== confirmPassword) {
      setAlert({ type: "error", text: "Нууц үг давтах хэсэг таарахгүй байна" });
      return;
    }
    try {
      setLoading(true);
      const response = await authService.register({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        email: email.trim(),
        phone: phone.trim(),
        password,
        role: "PATIENT",
      });
      const { token, user } = getAuthPayload(response.data);
      setAuth(token, user);
      setAlert({ type: "success", text: "Бүртгэл амжилттай. Хувийн мэдээллээ гүйцээнэ үү." });
      window.setTimeout(() => {
        onClose();
        router.replace("/dashboard/patient?section=profile");
        router.refresh();
      }, 450);
    } catch (error) {
      const status = (error as AxiosError).response?.status;
      setAlert({ type: "error", text: status === 409 ? "И-мэйл эсвэл утас бүртгэлтэй байна" : "Бүртгүүлэхэд алдаа гарлаа" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/55 px-4 py-8">
      <div className="relative w-full max-w-[430px] rounded-2xl bg-white p-6 shadow-2xl">
        <button type="button" aria-label="Close auth modal" className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-slate-100" onClick={onClose}>
          <X size={18} />
        </button>
        {mode === "login" ? (
          <>
            <h2 className="text-2xl font-bold text-navy">Үйлчлүүлэгчээр нэвтрэх</h2>
            {alert && <AuthAlert {...alert} />}
            <form className="mt-6 grid gap-3" onSubmit={handleLogin}>
              <Input type="email" placeholder="И-мэйл хаяг / Утасны дугаар" value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} />
              <Input type="password" placeholder="Нууц үг" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} />
              <Button disabled={loading}>{loading ? "Нэвтэрч байна..." : "Нэвтрэх"}</Button>
            </form>
            <button type="button" className="mt-3 h-11 w-full rounded-lg border border-sky-100 text-sm font-bold text-medical hover:bg-cyanSoft">Намууга</button>
            <button type="button" className="mt-3 text-sm font-semibold text-medical hover:text-sky-700">Нууц үгээ мартсан уу?</button>
            <div className="my-5 h-px bg-slate-100" />
            <p className="text-center text-sm text-slate-600">Шинэ хэрэглэгч бол бүртгүүлээрэй</p>
            <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => { setAlert(null); onModeChange("register"); }}>Бүртгүүлэх</Button>
            <SecurityText />
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-navy">Үйлчлүүлэгчээр бүртгүүлэх</h2>
            {alert && <AuthAlert {...alert} />}
            <form className="mt-6 grid gap-3" onSubmit={handleRegisterRequest}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input placeholder="Овог" value={lastName} onChange={(event) => setLastName(event.target.value)} disabled={loading} />
                <Input placeholder="Нэр" value={firstName} onChange={(event) => setFirstName(event.target.value)} disabled={loading} />
              </div>
              <Input type="email" placeholder="И-мэйл хаяг" value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} />
              <Input inputMode="tel" placeholder="Утасны дугаар" value={phone} onChange={(event) => setPhone(event.target.value)} disabled={loading} />
              <Input type="password" placeholder="Нууц үг" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} />
              <Input type="password" placeholder="Нууц үг давтах" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={loading} />
              <Button disabled={loading}>{loading ? "Бүртгэж байна..." : "Бүртгүүлэх"}</Button>
            </form>
            <div className="my-5 h-px bg-slate-100" />
            <p className="text-center text-sm text-slate-600">Өмнө нь бүртгүүлсэн бол?</p>
            <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => { setAlert(null); onModeChange("login"); }}>Нэвтрэх</Button>
            <SecurityText />
          </>
        )}
      </div>
    </div>
  );
}

function AuthAlert({ type, text }: AlertState) {
  const styles = type === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800";
  return <div className={`mt-5 rounded-lg border px-4 py-3 text-sm font-semibold ${styles}`}>{text}</div>;
}

function SecurityText() {
  return <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">ISO/IEC 27001 стандартын дагуу хэрэглэгчийн мэдээллийг хамгаална.</p>;
}
