import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AppointmentFilterContext = "doctor" | "hospital" | "laboratory" | "package";

const categories: Array<{ key: AppointmentFilterContext; label: string; href: string }> = [
  { key: "doctor", label: "Эмч", href: "/patient/home/search/doctor" },
  { key: "hospital", label: "Эмнэлэг", href: "/patient/home/search/hospital?type=private" },
  { key: "laboratory", label: "Лаборатори", href: "/patient/home/search/laboratory" },
];

const filtersByContext: Record<AppointmentFilterContext, string[]> = {
  doctor: ["Эрэмбэ", "Эмнэлэг", "Хүйс", "Үзлэгийн төрөл", "Нарийн мэргэжил"],
  hospital: ["Одоо нээлттэй", "Байршил", "Үйл ажиллагааны чиглэл"],
  laboratory: [],
  package: [],
};

export function AppointmentFilterSidebar({ active, children }: { active: AppointmentFilterContext; children?: ReactNode }) {
  return (
    <aside className="rounded-lg border border-sky-100 bg-white p-5 shadow-soft">
      <h2 className="text-xl font-bold text-navy">Шүүлт</h2>
      <div className="mt-5 grid gap-2 border-b border-sky-100 pb-4">
        {categories.map((category) => (
          <Link
            key={category.key}
            href={category.href}
            className={cn(
              "rounded-lg border px-3 py-3 text-left text-sm font-bold transition",
              active === category.key ? "border-sky-100 bg-cyanSoft text-medical" : "border-transparent text-slate-600 hover:border-sky-100 hover:bg-cyanSoft hover:text-medical",
            )}
          >
            {category.label}
          </Link>
        ))}
      </div>
      <div className="mt-4 grid gap-2">
        {children || filtersByContext[active].map((filter) => (
          <button key={filter} className="rounded-lg border border-sky-100 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-cyanSoft hover:text-medical">
            {filter}
          </button>
        ))}
      </div>
    </aside>
  );
}
