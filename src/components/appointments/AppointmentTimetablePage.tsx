"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api } from "@/services/api";
import { DoctorSummary, type DoctorDetail } from "./AppointmentBookingPage";

type DaySlots = {
  date: string;
  label: string;
  slots: Array<{ iso: string; label: string }>;
};

const weekdays = ["ням", "даваа", "мягмар", "лхагва", "пүрэв", "баасан", "бямба"];

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMongolianDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}. ${weekdays[date.getDay()]}`;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function AppointmentTimetablePage() {
  const router = useRouter();
  const [doctor, setDoctor] = useState<DoctorDetail | null>(null);
  const [mounted, setMounted] = useState(false);
  const [doctorId, setDoctorId] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [warning, setWarning] = useState("");

  useEffect(() => {
    setDoctorId(new URLSearchParams(window.location.search).get("service") || "");
    const today = toInputDate(new Date());
    setSelectedDay(today);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!doctorId) return;
    api.get(`/doctors/${doctorId}`).then((response) => setDoctor(response.data.data as DoctorDetail)).catch(() => setDoctor(null));
  }, [doctorId]);

  const availableDays = doctor?.availableDays?.length ? doctor.availableDays : [1, 2, 3, 4, 5];
  const daySlots = useMemo(() => generateAvailability(availableDays), [availableDays]);

  useEffect(() => {
    if (!daySlots.some((day) => day.date === selectedDay)) {
      setSelectedDay(daySlots[0]?.date || toInputDate(new Date()));
      setSelectedTime("");
    }
  }, [daySlots, selectedDay]);

  function continueToConfirmation() {
    if (!selectedTime) {
      setWarning("Цаг сонгоно уу.");
      return;
    }
    router.push(`/patient/home/appointment/confirmation?service=${encodeURIComponent(doctorId)}&time=${encodeURIComponent(selectedTime)}`);
  }

  if (!mounted) {
    return (
      <section className="bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold text-navy">Цаг захиалга</h1>
          <div className="mt-6 rounded-2xl border border-sky-100 bg-white p-6 text-sm font-semibold text-slate-500 shadow-soft">Цагийн хуваарь ачаалж байна...</div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <button type="button" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-medical hover:text-sky-600" onClick={() => router.back()}><ChevronLeft size={18} />Буцах</button>
        <h1 className="text-3xl font-bold text-navy">Цаг захиалга</h1>
        <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-2xl border border-sky-100 bg-white p-6 shadow-soft">
            {doctor ? <DoctorSummary doctor={doctor} /> : <p className="text-sm text-slate-500">Эмчийн мэдээлэл ачаалж байна...</p>}
            <div className="mt-6 grid gap-4">
              <div className="rounded-xl bg-cyanSoft p-4 text-sm font-bold text-medical">
                Эмчийн сонгосон гарагаар ойрын 7 хоногийн боломжит цаг харагдана.
              </div>
            </div>
          </aside>
          <main className="rounded-2xl border border-sky-100 bg-white p-6 shadow-soft">
            <h2 className="text-xl font-bold text-navy">Боломжтой цагууд</h2>
            <div className="mt-5 grid gap-4">
              {daySlots.map((day) => (
                <div key={day.date} className={`rounded-xl border p-4 transition ${selectedDay === day.date ? "border-medical bg-sky-50" : "border-sky-100 bg-white"}`}>
                  <button type="button" className="flex w-full items-center gap-2 text-left font-bold text-navy" onClick={() => { setSelectedDay(day.date); setSelectedTime(""); }}>
                    <CalendarDays size={18} className="text-medical" />
                    {day.label}
                  </button>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {day.slots.map((slot) => (
                      <button key={slot.iso} type="button" className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${selectedTime === slot.iso ? "border-medical bg-medical text-white" : "border-sky-100 bg-white text-slate-700 hover:bg-cyanSoft hover:text-medical"}`} onClick={() => { setSelectedDay(day.date); setSelectedTime(slot.iso); setWarning(""); }}>
                        <Clock size={15} className="mx-auto mb-1" />
                        {slot.label}
                      </button>
                    ))}
                    {day.slots.length === 0 && <p className="rounded-lg bg-cyanSoft p-3 text-sm font-semibold text-medical sm:col-span-3 md:col-span-4">Энэ өдөр боломжит цаг алга.</p>}
                  </div>
                </div>
              ))}
            </div>
            {warning && <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">{warning}</p>}
            <div className="mt-6 flex justify-end">
              <Button disabled={!doctorId} onClick={continueToConfirmation}>Үргэлжлүүлэх →</Button>
            </div>
          </main>
        </div>
      </div>
    </section>
  );
}

function generateAvailability(availableDays: number[]): DaySlots[] {
  const allowed = new Set(availableDays.length ? availableDays : [1, 2, 3, 4, 5]);
  const days: DaySlots[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let index = 0; index < 7; index += 1) {
    const cursor = new Date(today);
    cursor.setDate(today.getDate() + index);
    if (!allowed.has(cursor.getDay())) continue;
    const slots: DaySlots["slots"] = [];
    const slot = new Date(cursor);
    slot.setHours(9, 0, 0, 0);
    const now = new Date();
    const isToday = toInputDate(cursor) === toInputDate(now);
    if (isToday) {
      slot.setTime(Math.max(slot.getTime(), now.getTime() + 5 * 60 * 1000));
      slot.setSeconds(0, 0);
    }
    const last = new Date(cursor);
    last.setHours(17, 30, 0, 0);
    while (slot <= last) {
      slots.push({ iso: slot.toISOString(), label: formatTime(slot) });
      slot.setMinutes(slot.getMinutes() + 30);
    }
    days.push({
      date: toInputDate(cursor),
      label: formatMongolianDate(cursor),
      slots,
    });
  }
  return days;
}
