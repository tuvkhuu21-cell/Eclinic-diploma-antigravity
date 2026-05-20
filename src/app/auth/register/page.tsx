"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { authService } from "@/services/auth.service";
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

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AuthRole>("PATIENT");
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalAddress, setHospitalAddress] = useState("");
  const [hospitalDistrict, setHospitalDistrict] = useState("");
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAlert(null);

    if (!firstName.trim() || !email.trim() || !password.trim() || (role === "HOSPITAL" && !hospitalName.trim())) {
      setAlert({ type: "error", text: "Мэдээллээ бүрэн оруулна уу" });
      return;
    }

    if (password.length < 8) {
      setAlert({ type: "error", text: "Нууц үг хамгийн багадаа 8 тэмдэгттэй байх ёстой" });
      return;
    }

    try {
      setLoading(true);
      const response = await authService.register({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        email: email.trim(),
        password,
        role,
        hospitalName: hospitalName.trim() || undefined,
        hospitalAddress: hospitalAddress.trim() || undefined,
        hospitalDistrict: hospitalDistrict.trim() || undefined,
      });
      const { token, user } = getAuthPayload(response.data);
      setAuth(token, user);
      setAlert({ type: "success", text: "Амжилттай бүртгүүллээ" });
      window.setTimeout(() => {
        router.replace(dashboardByRole[user.role]);
        router.refresh();
      }, 500);
    } catch (error) {
      const status = (error as AxiosError).response?.status;
      setAlert({ type: "error", text: status === 409 ? "Энэ имэйл бүртгэлтэй байна" : "Мэдээллээ бүрэн оруулна уу" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-xl px-4 py-12">
      <Card className="p-6">
        <h1 className="text-3xl font-bold text-navy">Бүртгүүлэх</h1>
        <p className="mt-2 text-slate-600">Өвчтөн, эмч эсвэл байгууллагын админ эрхээр бүртгэл үүсгэнэ.</p>
        {alert && <AuthAlert type={alert.type} text={alert.text} />}
        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <Input placeholder="Нэр" value={firstName} onChange={(event) => setFirstName(event.target.value)} disabled={loading} />
          <Input placeholder="Овог" value={lastName} onChange={(event) => setLastName(event.target.value)} disabled={loading} />
          <Input className="md:col-span-2" type="email" placeholder="Имэйл" value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} />
          <Input type="password" placeholder="Нууц үг" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} />
          <select className="h-11 rounded-lg border border-slate-200 px-4 text-sm outline-none transition focus:border-medical focus:ring-4 focus:ring-sky-100 disabled:opacity-60" value={role} onChange={(event) => setRole(event.target.value as AuthRole)} disabled={loading}>
            <option value="PATIENT">PATIENT</option>
            <option value="DOCTOR">DOCTOR</option>
            <option value="HOSPITAL">HOSPITAL</option>
          </select>
          {role === "HOSPITAL" && (
            <>
              <Input className="md:col-span-2" placeholder="Байгууллага / эмнэлгийн нэр" value={hospitalName} onChange={(event) => setHospitalName(event.target.value)} disabled={loading} />
              <Input placeholder="Дүүрэг" value={hospitalDistrict} onChange={(event) => setHospitalDistrict(event.target.value)} disabled={loading} />
              <Input placeholder="Хаяг" value={hospitalAddress} onChange={(event) => setHospitalAddress(event.target.value)} disabled={loading} />
            </>
          )}
          <Button className="md:col-span-2" disabled={loading}>{loading ? "Бүртгэж байна..." : "Бүртгүүлэх"}</Button>
        </form>
        <p className="mt-4 text-sm text-slate-600">Бүртгэлтэй юу? <Link className="font-semibold text-medical" href="/auth/login">Нэвтрэх</Link></p>
      </Card>
    </section>
  );
}

function AuthAlert({ type, text }: AlertState) {
  const styles = type === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800";
  return <div className={`mt-5 rounded-lg border px-4 py-3 text-sm font-semibold shadow-sm ${styles}`}>{text}</div>;
}
