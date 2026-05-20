"use client";

import { useState } from "react";
import { CheckCircle2, Star } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DoctorProfileModal } from "./DoctorProfileModal";

export type Doctor = {
  id: string;
  specialty: string;
  bio?: string;
  experience: number;
  fee: number;
  rating: number;
  gender?: string | null;
  online: boolean;
  supportsOnline?: boolean;
  supportsInPerson?: boolean;
  availableDays?: number[];
  verified: boolean;
  hospital?: { id?: string; name: string; address?: string; phone?: string } | null;
  user: {
    firstName: string;
    lastName?: string;
  };
  _count?: {
    appointments?: number;
    consultations?: number;
  };
};

export function DoctorCard({ doctor }: { doctor: Doctor }) {
  const [open, setOpen] = useState(false);
  const name = `${doctor.user.lastName || ""} ${doctor.user.firstName}`.trim();
  const count = (doctor._count?.appointments || 0) + (doctor._count?.consultations || 0);

  return (
    <>
    <Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-soft">
      <button type="button" className="flex w-full gap-4 text-left" onClick={() => setOpen(true)}>
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-sky-100 text-xl font-bold text-medical">{name.slice(0, 2)}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-navy">{name}</h3>
                {doctor.verified && <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><CheckCircle2 size={13} /> Verified</span>}
              </div>
              <p className="text-sm text-slate-600">{doctor.specialty}</p>
            </div>
            <Badge className={doctor.online ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}><span className={`mr-2 inline-block h-2 w-2 rounded-full ${doctor.online ? "bg-emerald-500" : "bg-slate-400"}`} />{doctor.online ? "Active" : "Offline"}</Badge>
          </div>
          <p className="mt-2 text-sm text-slate-500">{doctor.hospital?.name || "Эмнэлэг сонгоогүй"} · {doctor.experience} жил</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-600"><Star size={16} fill="currentColor" />{doctor.rating} · {count} зөвлөгөө · {doctor.fee.toLocaleString()}₮</span>
          </div>
        </div>
      </button>
    </Card>
    <DoctorProfileModal doctor={open ? doctor : null} onClose={() => setOpen(false)} />
    </>
  );
}
