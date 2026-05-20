"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Building2, CalendarClock, HeartPulse, History, LayoutDashboard, LogOut, MessageCircle, Settings, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuthRole, AuthUser, useAuthStore } from "@/store/auth.store";
import { api } from "@/services/api";

const roleLabel: Record<AuthRole, string> = {
  PATIENT: "Үйлчлүүлэгчийн профайл",
  DOCTOR: "Эмчийн профайл",
  HOSPITAL: "Байгууллагын профайл",
  ADMIN: "Админ профайл",
};

const menuItemsByRole: Record<AuthRole, Array<{ label: string; href: string; icon: typeof HeartPulse }>> = {
  PATIENT: [
    { label: "Эрүүл мэндийн түүх", href: "/dashboard/patient", icon: HeartPulse },
    { label: "Захиалгын түүх", href: "/dashboard/patient?section=orders", icon: History },
    { label: "Тохиргоо", href: "/patient/home/settings", icon: Settings },
  ],
  DOCTOR: [
    { label: "Хянах самбар", href: "/dashboard/doctor", icon: LayoutDashboard },
    { label: "Хувийн мэдээлэл", href: "/dashboard/doctor?section=profile", icon: UserRound },
    { label: "Цаг захиалгууд", href: "/dashboard/doctor?section=appointments", icon: CalendarClock },
    { label: "Чат", href: "/dashboard/doctor?section=chat", icon: MessageCircle },
    { label: "Тохиргоо", href: "/dashboard/doctor?section=settings", icon: Settings },
  ],
  ADMIN: [
    { label: "Хянах самбар", href: "/dashboard/admin", icon: LayoutDashboard },
    { label: "Тохиргоо", href: "/dashboard/admin", icon: Settings },
  ],
  HOSPITAL: [
    { label: "Байгууллагын самбар", href: "/dashboard/hospital", icon: Building2 },
    { label: "Эмч нар", href: "/dashboard/hospital?section=doctors", icon: UserRound },
    { label: "Өвчтөн / захиалга", href: "/dashboard/hospital?section=patients", icon: CalendarClock },
    { label: "Шинжилгээ", href: "/dashboard/hospital?section=labs", icon: HeartPulse },
    { label: "Тохиргоо", href: "/dashboard/hospital?section=settings", icon: Settings },
  ],
};

export function UserAvatarMenu({ user, role, buttonClassName }: { user?: AuthUser; role?: AuthRole; buttonClassName?: string }) {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeRole = user?.role || role || "PATIENT";
  const profileHref = activeRole === "DOCTOR" ? "/dashboard/doctor?section=profile" : activeRole === "ADMIN" ? "/dashboard/admin" : activeRole === "HOSPITAL" ? "/dashboard/hospital" : "/dashboard/patient?section=profile";
  const menuItems = menuItemsByRole[activeRole];
  const initials = `${user?.lastName?.[0] || ""}${user?.firstName?.[0] || "Х"}`;
  const fullName = `${user?.lastName || ""} ${user?.firstName || "Хэрэглэгч"}`.trim();

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  async function handleLogout() {
    setOpen(false);
    if (activeRole === "DOCTOR") await api.patch("/doctors/me", { online: false }).catch(() => null);
    logout();
    router.replace("/");
  }

  return (
    <div ref={rootRef} className="relative z-[120]">
      <button
        type="button"
        aria-label="User menu"
        className={cn("grid h-11 w-11 place-items-center rounded-full bg-medical text-sm font-extrabold text-white shadow-sm ring-2 ring-white/70 transition hover:scale-[1.03] hover:bg-[#1d6758]", buttonClassName)}
        onClick={() => setOpen((current) => !current)}
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+12px)] z-[130] w-[min(330px,calc(100vw-1.5rem))] overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-[0_24px_70px_rgba(25,105,89,0.20)] ring-1 ring-white">
          <Link href={profileHref} prefetch={false} onClick={() => setOpen(false)} className="flex items-center gap-3 border-b border-emerald-100 bg-gradient-to-br from-cyanSoft to-white px-4 py-4 text-left transition hover:from-emerald-50 hover:to-cyanSoft">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-medical font-extrabold text-white shadow-sm">{initials}</div>
            <div className="min-w-0">
              <p className="truncate font-bold text-navy">{fullName}</p>
              <p className="mt-0.5 text-xs font-semibold text-medical">{roleLabel[activeRole]}</p>
            </div>
          </Link>
          <div className="max-h-[min(70vh,560px)] overflow-y-auto py-2">
            {menuItems.map(({ label, href, icon: Icon }) => (
              <Link key={label} href={href} prefetch={false} onClick={() => setOpen(false)} className="mx-2 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-cyanSoft hover:text-medical">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-50 text-medical"><Icon size={16} /></span>
                {label}
              </Link>
            ))}
            <button type="button" onClick={handleLogout} className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-cyanSoft hover:text-medical">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-50 text-medical"><LogOut size={16} /></span>
              Системээс гарах
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
