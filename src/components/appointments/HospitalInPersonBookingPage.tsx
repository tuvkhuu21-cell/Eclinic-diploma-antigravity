"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CalendarDays, ChevronLeft, Clock, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Doctor } from "@/components/doctors/DoctorCard";
import { api } from "@/services/api";

const defaultPrice = 30000;

export function HospitalInPersonBookingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [hospitalId, setHospitalId] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [selectedVisitType, setSelectedVisitType] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [warning, setWarning] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const today = toInputDate(new Date());
    setHospitalId(params.get("hospitalId") || "");
    setHospitalName(params.get("hospitalName") || "Эмнэлэг");
    setSelectedVisitType(params.get("specialty") || "");
    setSelectedDoctorId(params.get("doctorId") || "");
    setSelectedDate(today);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!hospitalId) return;
    api.get("/doctors", { params: { hospitalId, visit: "inPerson", limit: 80 } })
      .then((response) => setDoctors(response.data.data as Doctor[]))
      .catch(() => setDoctors([]));
  }, [hospitalId]);

  const hospitalDoctors = useMemo(() => {
    const exact = doctors.filter((doctor) => (doctor.supportsInPerson ?? true) && (!hospitalId || doctor.hospital?.id === hospitalId || normalize(doctor.hospital?.name || "") === normalize(hospitalName)));
    if (!selectedVisitType) return exact;
    return exact.filter((doctor) => specialtyMatches(doctor.specialty, selectedVisitType));
  }, [doctors, hospitalId, hospitalName, selectedVisitType]);

  const slots = useMemo(() => generateSlots(selectedDate), [selectedDate]);
  const selectedDoctor = hospitalDoctors.find((doctor) => doctor.id === selectedDoctorId);
  const allHospitalDoctors = useMemo(() => doctors.filter((doctor) => (doctor.supportsInPerson ?? true) && (!hospitalId || doctor.hospital?.id === hospitalId || normalize(doctor.hospital?.name || "") === normalize(hospitalName))), [doctors, hospitalId, hospitalName]);
  const registeredSpecialties = Array.from(new Set(allHospitalDoctors.map((doctor) => doctor.specialty).filter(Boolean)));
  const visibleVisitTypes = registeredSpecialties;

  function continueToConfirmation() {
    if (!selectedVisitType) return setWarning("Үзлэгийн төрлөө сонгоно уу.");
    if (!selectedDoctorId) return setWarning("Эмч сонгоно уу.");
    if (!selectedDate || !selectedTime) return setWarning("Огноо, цаг сонгоно уу.");
    const scheduledAt = `${selectedDate}T${selectedTime}:00`;
    const query = new URLSearchParams({
      doctorId: selectedDoctorId,
      hospitalId,
      hospitalName,
      specialty: selectedVisitType,
      doctorName: selectedDoctor ? `${selectedDoctor.user.lastName || ""} ${selectedDoctor.user.firstName}`.trim() : "",
      room: roomForDoctor(selectedDoctorId),
      scheduledAt,
      type: "HOSPITAL_VISIT",
      price: String(defaultPrice),
    });
    router.push(`/patient/home/appointment/confirmation?${query.toString()}`);
  }

  if (!mounted) return <section className="bg-slate-50 px-4 py-8" />;

  return (
    <section className="bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <button type="button" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-medical hover:text-sky-600" onClick={() => router.back()}><ChevronLeft size={18} />Буцах</button>
        <h1 className="text-3xl font-bold text-navy">Эмнэлэгт үзүүлэх цаг авах</h1>
        <div className="mt-6 rounded-2xl border border-sky-100 bg-white p-6 shadow-soft">
          <div className="flex items-center gap-4 rounded-2xl bg-cyanSoft p-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-medical"><Building2 size={28} /></div>
            <div>
              <p className="text-sm font-semibold text-medical">Сонгосон эмнэлэг</p>
              <h2 className="text-xl font-bold text-navy">{hospitalName}</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
            <aside>
              <h3 className="font-bold text-navy">1. Үзлэгийн төрөл</h3>
              <div className="mt-3 max-h-[520px] overflow-y-auto rounded-2xl border border-sky-100 p-2">
                {visibleVisitTypes.map((type) => (
                  <button key={type} type="button" className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${selectedVisitType === type ? "bg-medical text-white" : "text-slate-600 hover:bg-cyanSoft hover:text-medical"}`} onClick={() => { setSelectedVisitType(type); setSelectedDoctorId(""); setWarning(""); }}>
                    <Stethoscope size={15} />
                    {type}
                  </button>
                ))}
              </div>
            </aside>
            <main className="grid gap-6">
              <section>
                <h3 className="font-bold text-navy">2. Эмч сонгох</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {hospitalDoctors.map((doctor) => {
                    const name = `${doctor.user.lastName || ""} ${doctor.user.firstName}`.trim();
                    return (
                      <button key={doctor.id} type="button" className={`rounded-2xl border p-4 text-left transition ${selectedDoctorId === doctor.id ? "border-medical bg-cyanSoft ring-4 ring-sky-100" : "border-sky-100 hover:bg-cyanSoft"}`} onClick={() => { setSelectedDoctorId(doctor.id); setWarning(""); }}>
                        <div className="flex gap-3">
                          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white font-bold text-medical">{name.slice(0, 2)}</div>
                          <div>
                            <p className="font-bold text-navy">{name}</p>
                            <p className="mt-1 text-sm font-semibold text-medical">{doctor.specialty}</p>
                            <p className="mt-1 text-xs text-slate-500">{doctor.experience} жил · 30,000₮ · Өрөө {roomForDoctor(doctor.id)}</p>
                            <p className="mt-2 text-xs font-semibold text-medical">Боломжтой: {generateSlots(selectedDate).slice(0, 4).join(", ")}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {hospitalDoctors.length === 0 && <p className="rounded-2xl border border-dashed border-sky-100 bg-cyanSoft p-5 text-center font-bold text-navy md:col-span-2">{selectedVisitType ? "Энэ төрлөөр бүртгэлтэй эмч алга." : "Энэ эмнэлэгт бүртгэлтэй эмч одоогоор алга."}</p>}
                </div>
              </section>

              <section>
                <h3 className="font-bold text-navy">3. Огноо, цаг сонгох</h3>
                <div className="mt-3 grid gap-4 rounded-2xl border border-sky-100 p-4">
                  <label className="text-sm font-bold text-navy">
                    Огноо
                    <input type="date" className="mt-2 h-11 w-full rounded-lg border border-sky-100 px-3 outline-none focus:border-medical" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setSelectedTime(""); }} />
                  </label>
                  <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {slots.map((slot) => (
                      <button key={slot} type="button" className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${selectedTime === slot ? "border-medical bg-medical text-white" : "border-sky-100 text-slate-700 hover:bg-cyanSoft hover:text-medical"}`} onClick={() => { setSelectedTime(slot); setWarning(""); }}>
                        <Clock size={15} className="mx-auto mb-1" />
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </main>
          </div>
          {warning && <p className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">{warning}</p>}
          <div className="mt-6 flex justify-end">
            <Button onClick={continueToConfirmation}>Үргэлжлүүлэх →</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function toInputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function generateSlots(_date: string) {
  return ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00"];
}

function roomForDoctor(id: string) {
  const total = Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return `${Math.max(101, 100 + (total % 48))}`;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[,\s/-]/g, "");
}

function specialtyMatches(doctorSpecialty: string, selectedSpecialty: string) {
  const doctorValue = normalize(doctorSpecialty);
  const selectedValue = normalize(selectedSpecialty);
  if (doctorValue.includes(selectedValue) || selectedValue.includes(doctorValue)) return true;
  const aliases: Record<string, string[]> = {
    [normalize("Арьс, харшил")]: [normalize("Арьс"), normalize("Харшил")],
    [normalize("Дотоод шүүрэл, чихрийн шижин")]: [normalize("Дотоод шүүрэл"), normalize("чихрийн шижин")],
    [normalize("Хоол боловсруулах эрхтэн судлал")]: [normalize("Хоол боловсруулах")],
  };
  return (aliases[selectedValue] || [selectedValue]).some((needle) => doctorValue.includes(needle));
}
