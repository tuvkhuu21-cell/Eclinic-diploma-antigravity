"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Clock, Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api } from "@/services/api";

const DEFAULT_ONLINE_PRICE = 30000;

export type DoctorDetail = {
  id: string;
  specialty: string;
  bio?: string;
  experience: number;
  fee: number;
  rating: number;
  online?: boolean;
  supportsOnline?: boolean;
  supportsInPerson?: boolean;
  availableDays?: number[];
  verified?: boolean;
  hospital?: { name: string } | null;
  user: { firstName: string; lastName?: string };
};

export function AppointmentBookingPage() {
  const router = useRouter();
  const [doctor, setDoctor] = useState<DoctorDetail | null>(null);
  const [selectedTime, setSelectedTime] = useState("");
  const doctorId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("doctorId") || "" : "";
  const slots = useMemo(() => generateTodaySlots(), []);

  useEffect(() => {
    if (!doctorId) return;
    api.get(`/doctors/${doctorId}`).then((response) => setDoctor(response.data.data as DoctorDetail)).catch(() => setDoctor(null));
  }, [doctorId]);

  return (
    <section className="bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <button type="button" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-medical hover:text-sky-600" onClick={() => router.back()}><ChevronLeft size={18} />Буцах</button>
        <h1 className="text-3xl font-bold text-navy">Цаг захиалах</h1>
        <div className="mt-6 rounded-2xl border border-sky-100 bg-white p-6 shadow-soft">
          {doctor ? <DoctorSummary doctor={doctor} /> : <p className="text-sm text-slate-500">Эмчийн мэдээлэл ачаалж байна...</p>}
          <h2 className="mt-8 text-xl font-bold text-navy">Өнөөдрийн боломжит цаг</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 md:grid-cols-4">
            {slots.map((slot) => (
              <button key={slot.iso} type="button" className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${selectedTime === slot.iso ? "border-medical bg-cyanSoft text-medical ring-4 ring-sky-100" : "border-sky-100 bg-white text-slate-700 hover:bg-cyanSoft"}`} onClick={() => setSelectedTime(slot.iso)}>
                <Clock className="mx-auto mb-1 text-medical" size={18} />{slot.label}
              </button>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <Button disabled={!doctor || !selectedTime} onClick={() => router.push(`/patient/home/appointment/confirmation?doctorId=${doctorId}&time=${encodeURIComponent(selectedTime)}`)}>Үргэлжлүүлэх →</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function DoctorSummary({ doctor }: { doctor: DoctorDetail }) {
  return (
    <div className="flex items-start gap-4">
      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-cyanSoft font-bold text-medical">{doctor.user.lastName?.[0] || ""}{doctor.user.firstName[0]}</div>
      <div>
        <h2 className="text-xl font-bold text-navy">{doctor.user.lastName} {doctor.user.firstName}</h2>
        <p className="mt-1 text-sm font-semibold text-medical">{doctor.specialty}</p>
        <p className="mt-2 inline-flex items-center gap-1 text-sm text-amber-600"><Star size={15} fill="currentColor" />{doctor.rating} · {doctor.experience} жил · {formatCurrency(getOnlinePrice(doctor.fee))}₮</p>
      </div>
    </div>
  );
}

function getOnlinePrice(fee?: number) {
  return fee && fee > 0 ? fee : DEFAULT_ONLINE_PRICE;
}

function formatCurrency(value: number) {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function generateTodaySlots() {
  const slots: Array<{ iso: string; label: string }> = [];
  const current = new Date();
  current.setMinutes(current.getMinutes() + 5);
  current.setSeconds(0, 0);
  const end = new Date();
  end.setHours(23, 30, 0, 0);
  while (current <= end) {
    slots.push({ iso: current.toISOString(), label: current.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" }) });
    current.setMinutes(current.getMinutes() + 30);
  }
  return slots;
}
