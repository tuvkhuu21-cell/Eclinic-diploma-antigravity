"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { hospitals } from "@/lib/constants";

export type DoctorSortKey = "experience" | "rating" | "consultations";
export type SortDirection = "desc" | "asc";
export type DoctorSort = { key: DoctorSortKey; direction: SortDirection } | null;
export type GenderFilter = "Бүгд" | "Эрэгтэй" | "Эмэгтэй";
export type VisitTypeFilter = "Онлайн" | "Биечлэн";

export type DoctorFilters = {
  sort: DoctorSort;
  hospital: string;
  gender: GenderFilter;
  visitTypes: VisitTypeFilter[];
  specialty: string;
};

const categories = [
  { label: "Эмч", href: "/patient/home/search/doctor", active: true },
  { label: "Эмнэлэг", href: "/patient/home/search/hospital?type=private" },
  { label: "Лаборатори", href: "/patient/home/search/laboratory" },
];

const baseHospitals = [
  "Dental art шүдний эмнэлэг",
  "E Dent",
  "eClinic",
  "HFS Үүдэл эсийн клиник",
  "ICU",
  "MediCare Hospital",
  "UB Songdo Hospital",
  "Улсын нэгдүгээр төв эмнэлэг",
  "Улсын гуравдугаар төв эмнэлэг",
];

const specialties = [
  "Бүгд",
  "Дотор",
  "Арьс, харшил",
  "Бөөр",
  "Гэмтэл",
  "Дотоод шүүрэл, чихрийн шижин",
  "Зүрх судас",
  "Мэдрэл",
  "Мэс засал",
  "Нүд",
  "Үргүйдэл, үр шилжүүлэн суулгах",
  "Сэргээн засах, нөхөн сэргээх",
  "Сэтгэл зүйч",
  "Сэтгэц",
  "Уламжлалт",
  "Уушги",
  "Хавдар",
  "Халдварт",
  "Хоол боловсруулах эрхтэн судлал",
  "Хоол зүйч, шим тэжээл судлал",
  "Хүүхэд",
  "Шүд",
  "Эрэгтэйчүүд",
  "Үе мөч",
  "Эх барих, эмэгтэйчүүд",
  "Чих хамар хоолой",
  "Цус",
  "Эмгэг судлаач эмч",
  "Эрхтэн шилжүүлэн суулгах",
  "Дүрс оношилгоо",
  "Хөнгөвчлөх эмчилгээ",
  "Эмнэлэг зуучлал",
  "Сүрьеэ",
  "Мэдрэлийн мэс засал",
  "Бэлгийн замаар дамжих халдвар",
  "Нярай",
  "Гоо засал, мэс засал",
  "Урологи",
  "Жирэмсний эрүүл мэнд",
];

type PopoverKey = "sort" | "hospital" | "gender" | "visitType" | "specialty";

export function DoctorFilterSidebar({ filters, onChange, hospitalOptions: doctorHospitalOptions = [] }: { filters: DoctorFilters; onChange: (filters: DoctorFilters) => void; hospitalOptions?: string[] }) {
  const [open, setOpen] = useState<PopoverKey | null>(null);
  const [hospitalSearch, setHospitalSearch] = useState("");
  const [specialtySearch, setSpecialtySearch] = useState("");
  const rootRef = useRef<HTMLElement>(null);

  const hospitalOptions = useMemo(() => {
    const names = [...baseHospitals, ...hospitals.map((hospital) => hospital.name), ...doctorHospitalOptions]
      .filter((name) => !/pharmacy|эмийн сан/i.test(name));
    return Array.from(new Set(names)).filter((name) => name.toLowerCase().includes(hospitalSearch.toLowerCase()));
  }, [doctorHospitalOptions, hospitalSearch]);

  const specialtyOptions = useMemo(() => (
    specialties.filter((specialty) => specialty.toLowerCase().includes(specialtySearch.toLowerCase()))
  ), [specialtySearch]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(null);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function patch(next: Partial<DoctorFilters>) {
    onChange({ ...filters, ...next });
  }

  function toggleVisitType(value: VisitTypeFilter) {
    patch({ visitTypes: toggleValue(filters.visitTypes, value) });
  }

  return (
    <aside ref={rootRef} className="rounded-lg border border-sky-100 bg-white p-5 shadow-soft">
      <h2 className="text-xl font-bold text-navy">Шүүлт</h2>
      <div className="mt-5 grid gap-2 border-b border-sky-100 pb-4">
        {categories.map((category) => (
          <Link
            key={category.label}
            href={category.href}
            prefetch={false}
            className={cn(
              "rounded-lg border px-3 py-3 text-left text-sm font-bold transition",
              category.active ? "border-sky-100 bg-cyanSoft text-medical" : "border-transparent text-slate-600 hover:border-sky-100 hover:bg-cyanSoft hover:text-medical",
            )}
          >
            {category.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-2">
        <FilterRow label="Эрэмбэ" open={open === "sort"} onClick={() => setOpen(open === "sort" ? null : "sort")}>
          <SortPopover value={filters.sort} onSelect={(sort) => patch({ sort })} onClear={() => patch({ sort: null })} />
        </FilterRow>

        <FilterRow label="Эмнэлэг" open={open === "hospital"} onClick={() => setOpen(open === "hospital" ? null : "hospital")}>
          <SearchableRadioPopover
            searchValue={hospitalSearch}
            searchPlaceholder="Эмнэлэг хайх..."
            options={hospitalOptions}
            value={filters.hospital}
            onSearch={setHospitalSearch}
            onSelect={(hospital) => patch({ hospital })}
          />
        </FilterRow>

        <FilterRow label="Хүйс" open={open === "gender"} onClick={() => setOpen(open === "gender" ? null : "gender")}>
          <div className="grid gap-2">
            {(["Бүгд", "Эрэгтэй", "Эмэгтэй"] as GenderFilter[]).map((gender) => (
              <RadioOption key={gender} label={gender} checked={filters.gender === gender} onChange={() => patch({ gender })} />
            ))}
          </div>
        </FilterRow>

        <FilterRow label="Үзлэгийн төрөл" open={open === "visitType"} onClick={() => setOpen(open === "visitType" ? null : "visitType")}>
          <div className="grid gap-2">
            {(["Онлайн", "Биечлэн"] as VisitTypeFilter[]).map((visitType) => (
              <CheckboxOption key={visitType} label={visitType} checked={filters.visitTypes.includes(visitType)} onChange={() => toggleVisitType(visitType)} />
            ))}
          </div>
        </FilterRow>

        <FilterRow label="Нарийн мэргэжил" open={open === "specialty"} onClick={() => setOpen(open === "specialty" ? null : "specialty")}>
          <SearchableRadioPopover
            searchValue={specialtySearch}
            searchPlaceholder="Нарийн мэргэжил..."
            options={specialtyOptions}
            value={filters.specialty || "Бүгд"}
            onSearch={setSpecialtySearch}
            onSelect={(specialty) => patch({ specialty: specialty === "Бүгд" ? "" : specialty })}
          />
        </FilterRow>
      </div>
    </aside>
  );
}

function FilterRow({ label, open, onClick, children }: { label: string; open: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <div className="relative">
      <button type="button" className="flex w-full items-center justify-between rounded-lg border border-sky-100 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-cyanSoft hover:text-medical" onClick={onClick}>
        {label}
        <ChevronDown size={16} className={cn("text-medical transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-30 w-full rounded-xl border border-sky-100 bg-white p-4 text-medical shadow-soft">
          {children}
        </div>
      )}
    </div>
  );
}

function SortPopover({ value, onSelect, onClear }: { value: DoctorSort; onSelect: (value: DoctorSort) => void; onClear: () => void }) {
  const groups: Array<{ title: string; key: DoctorSortKey }> = [
    { title: "Туршлага", key: "experience" },
    { title: "Үнэлгээ", key: "rating" },
    { title: "Үзлэгийн тоо", key: "consultations" },
  ];

  return (
    <div className="grid gap-4">
      {groups.map((group) => (
        <div key={group.key}>
          <p className="mb-2 text-sm font-bold text-navy">{group.title}</p>
          <div className="grid gap-2">
            <RadioOption label="Ихээс бага" checked={value?.key === group.key && value.direction === "desc"} onChange={() => onSelect({ key: group.key, direction: "desc" })} />
            <RadioOption label="Багаас их" checked={value?.key === group.key && value.direction === "asc"} onChange={() => onSelect({ key: group.key, direction: "asc" })} />
          </div>
        </div>
      ))}
      <button type="button" className="mt-1 h-10 rounded-lg bg-medical text-sm font-bold text-white hover:bg-sky-600" onClick={onClear}>
        Цэвэрлэх
      </button>
    </div>
  );
}

function SearchableRadioPopover({ searchValue, searchPlaceholder, options, value, onSearch, onSelect }: { searchValue: string; searchPlaceholder: string; options: string[]; value: string; onSearch: (value: string) => void; onSelect: (value: string) => void }) {
  return (
    <div>
      <div className="flex items-center rounded-lg border border-sky-100 px-3 py-2">
        <Search size={15} className="text-medical" />
        <input className="ml-2 w-full text-sm text-slate-700 outline-none placeholder:text-slate-400" placeholder={searchPlaceholder} value={searchValue} onChange={(event) => onSearch(event.target.value)} />
      </div>
      <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1">
        {options.map((option) => (
          <RadioOption key={option} label={option} checked={value === option} onChange={() => onSelect(option)} />
        ))}
      </div>
    </div>
  );
}

function RadioOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm font-semibold text-slate-700 hover:bg-cyanSoft">
      <input type="radio" className="h-4 w-4 accent-medical" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

function CheckboxOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm font-semibold text-slate-700 hover:bg-cyanSoft">
      <input type="checkbox" className="h-4 w-4 rounded accent-medical" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

function toggleValue<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}
