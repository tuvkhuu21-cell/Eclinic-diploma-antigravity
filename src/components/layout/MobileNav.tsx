"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarPlus, Home, Hospital, MessageCircle, Stethoscope } from "lucide-react";

const items = [
  { href: "/", icon: Home, label: "Нүүр" },
  { href: "/doctors", icon: Stethoscope, label: "Эмч" },
  { href: "/hospitals", icon: Hospital, label: "Эмнэлэг" },
  { href: "/?appointment=select", icon: CalendarPlus, label: "Цаг" },
  { href: "/chat", icon: MessageCircle, label: "Чат" },
];

export function MobileNav() {
  const pathname = usePathname();
  if (pathname === "/doctor/login" || pathname === "/doctor/register") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t bg-white px-2 py-2 text-[11px] font-semibold text-slate-600 md:hidden">
      {items.map(({ href, icon: Icon, label }) => <Link key={href} href={href} prefetch={false} className="flex flex-col items-center gap-1"><Icon size={18} />{label}</Link>)}
    </nav>
  );
}
