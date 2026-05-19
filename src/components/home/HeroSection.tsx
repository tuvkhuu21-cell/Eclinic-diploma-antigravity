"use client";

import Image from "next/image";
import Link from "next/link";
import { CalendarCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAuthStore } from "@/store/auth.store";

export function HeroSection({ onRequireLogin }: { onRequireLogin?: () => void }) {
  const { token, hasHydrated } = useAuthStore();
  const loggedIn = hasHydrated && Boolean(token);

  function handleAppointmentClick() {
    if (!loggedIn) {
      onRequireLogin?.();
      return;
    }
    window.location.href = "/?appointment=select";
  }

  return (
    <section className="bg-gradient-to-b from-white to-cyanSoft">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <Badge>Онлайн эмнэлгийн нэгдсэн үйлчилгээ</Badge>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight text-navy md:text-6xl">Эрүүл мэндийн үйлчилгээг гэрээсээ хурдан, найдвартай аваарай</h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-600">MediConnect нь эмчийн цаг захиалга, онлайн зөвлөгөө, шинжилгээний хариу, AI туслах болон бодит цагийн харилцааг нэг дор нэгтгэнэ.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button type="button" onClick={handleAppointmentClick}><CalendarCheck size={18} className="mr-2" />Цаг захиалах</Button>
            <Link href={loggedIn ? "/consultation" : "#"} onClick={(event) => { if (!loggedIn) { event.preventDefault(); onRequireLogin?.(); } }}>
              <Button type="button" variant="secondary"><Sparkles size={18} className="mr-2" />Яг одоо зөвлөгөө авах</Button>
            </Link>
          </div>
        </div>
        <div className="relative">
          <Image src="/images/hero-medical.svg" alt="MediConnect medical platform" width={960} height={640} className="rounded-lg shadow-soft" priority />
        </div>
      </div>
    </section>
  );
}
