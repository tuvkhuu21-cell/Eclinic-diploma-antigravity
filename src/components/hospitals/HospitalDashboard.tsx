"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Activity, Building2, CalendarClock, FilePlus2, FlaskConical, LayoutDashboard, LogOut, Search, Stethoscope, UsersRound } from "lucide-react";
import { api } from "@/services/api";
import { useAuthStore } from "@/store/auth.store";

type HospitalDashboardData = {
  hospital: { name: string; type: string; phone?: string | null; address: string; district: string; rating: number };
  summary: { doctors: number; patients: number; appointments: number; packageOrders: number; labResults: number; revenue: number };
  doctors: Array<{ id: string; name: string; specialty: string; email: string; phone?: string | null; online: boolean; verified: boolean; fee: number; appointments: number }>;
  patients: Array<{ id: string; name: string; email?: string | null; phone?: string | null; totalOrders: number; latestOrder?: string }>;
  appointments: Array<{ id: string; patientId: string; patientName: string; doctorName: string; specialty: string; scheduledAt: string; type: string; reason: string; paymentStatus: string; status: string; price: number }>;
  labResults: Array<{ id: string; code: string; title: string; summary?: string | null; issuedAt: string; patientName: string; patientEmail: string }>;
  healthPackages: Array<{ id: string; name: string; description: string; summary: string; oldPrice: number; price: number; discount: string; icon: string; labHours: string; tests: Array<{ title: string; tests: string[]; importance: string }>; active: boolean }>;
};

const emptyData: HospitalDashboardData = {
  hospital: { name: "Байгууллага", type: "Эмнэлэг", address: "", district: "", rating: 0 },
  summary: { doctors: 0, patients: 0, appointments: 0, packageOrders: 0, labResults: 0, revenue: 0 },
  doctors: [],
  patients: [],
  appointments: [],
  labResults: [],
  healthPackages: [],
};

type Section = "overview" | "doctors" | "patients" | "packages" | "labs" | "settings";

export function HospitalDashboard() {
  const logout = useAuthStore((state) => state.logout);
  const [data, setData] = useState<HospitalDashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>("overview");
  const [search, setSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [labTitle, setLabTitle] = useState("");
  const [labSummary, setLabSummary] = useState("");
  const [labFileUrl, setLabFileUrl] = useState("");
  const [savingLab, setSavingLab] = useState(false);
  const [savingPackage, setSavingPackage] = useState(false);
  const [packageForm, setPackageForm] = useState({
    name: "",
    description: "",
    summary: "",
    oldPrice: "",
    price: "",
    discount: "",
    labHours: "08:30 - 17:00 (Даваа-Баасан)",
    testsText: "Цусны дэлгэрэнгүй шинжилгээ\n- WBC / Цагаан эс\n- RBC / Улаан эс\nАч холбогдол: Ерөнхий үрэвсэл, цус багадалтыг үнэлнэ.",
  });
  const [notice, setNotice] = useState("");

  async function loadDashboard() {
    try {
      const response = await api.get("/hospital-admin");
      const next = response.data.data as HospitalDashboardData;
      setData(next);
      setSelectedPatientId((current) => current || next.patients[0]?.id || "");
    } catch {
      setData(emptyData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("section") as Section | null;
    if (requested && ["overview", "doctors", "patients", "packages", "labs", "settings"].includes(requested)) setSection(requested);
    void loadDashboard();
  }, []);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredDoctors = useMemo(() => data.doctors.filter((doctor) => `${doctor.name} ${doctor.specialty} ${doctor.email}`.toLowerCase().includes(normalizedSearch)), [data.doctors, normalizedSearch]);
  const filteredPatients = useMemo(() => data.patients.filter((patient) => `${patient.name} ${patient.email || ""} ${patient.phone || ""}`.toLowerCase().includes(normalizedSearch)), [data.patients, normalizedSearch]);
  const packageOrders = useMemo(() => data.appointments.filter((item) => item.type === "PACKAGE_ORDER" || item.reason.includes("Багц шинжилгээ")), [data.appointments]);

  async function createLabResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    if (!selectedPatientId || !labTitle.trim()) {
      setNotice("Өвчтөн болон шинжилгээний нэрээ сонгоно уу.");
      return;
    }
    try {
      setSavingLab(true);
      await api.post("/hospital-admin", {
        patientId: selectedPatientId,
        title: labTitle.trim(),
        summary: labSummary.trim() || undefined,
        doctorNote: labSummary.trim() || undefined,
        fileUrl: labFileUrl.trim() || "",
        fileName: labFileUrl.trim() ? labTitle.trim() : undefined,
      });
      setLabTitle("");
      setLabSummary("");
      setLabFileUrl("");
      setNotice("Шинжилгээний хариу өвчтөний profile дээр нэмэгдлээ.");
      await loadDashboard();
    } catch {
      setNotice("Шинжилгээ нэмэхэд алдаа гарлаа. Өвчтөн энэ байгууллагатай холбоотой эсэхийг шалгана уу.");
    } finally {
      setSavingLab(false);
    }
  }

  async function createHealthPackage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    const tests = parsePackageTests(packageForm.testsText);
    if (!packageForm.name.trim() || !packageForm.description.trim() || !packageForm.price.trim() || !tests.length) {
      setNotice("Багцын нэр, тайлбар, үнэ болон шинжилгээний мэдээллээ бүрэн оруулна уу.");
      return;
    }
    try {
      setSavingPackage(true);
      await api.post("/hospital-admin/packages", {
        name: packageForm.name.trim(),
        description: packageForm.description.trim(),
        summary: packageForm.summary.trim() || packageForm.description.trim(),
        oldPrice: Number(packageForm.oldPrice) || undefined,
        price: Number(packageForm.price),
        discount: packageForm.discount.trim() || undefined,
        labHours: packageForm.labHours.trim() || undefined,
        tests,
        active: true,
      });
      setPackageForm((current) => ({ ...current, name: "", description: "", summary: "", oldPrice: "", price: "", discount: "" }));
      setNotice("Багц шинжилгээ нэмэгдлээ. Өвчтөнүүд харах боломжтой.");
      await loadDashboard();
    } catch {
      setNotice("Багц шинжилгээ нэмэхэд алдаа гарлаа.");
    } finally {
      setSavingPackage(false);
    }
  }

  return (
    <section className="min-h-screen bg-[#eef5fb] p-4 text-slate-900">
      <div className="mx-auto grid max-w-[1500px] overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_24px_80px_rgba(31,74,125,0.18)] lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="bg-[#0875c9] px-5 py-6 text-white">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15"><Building2 size={22} /></div>
            <div>
              <p className="text-sm font-bold text-sky-100">{data.hospital.type}</p>
              <h1 className="line-clamp-1 text-lg font-black">{data.hospital.name}</h1>
            </div>
          </div>
          <nav className="mt-8 grid gap-2">
            <NavButton active={section === "overview"} icon={LayoutDashboard} label="Dashboard" onClick={() => setSection("overview")} />
            <NavButton active={section === "doctors"} icon={Stethoscope} label="Эмч нар" onClick={() => setSection("doctors")} />
            <NavButton active={section === "patients"} icon={UsersRound} label="Өвчтөн / Захиалга" onClick={() => setSection("patients")} />
            <NavButton active={section === "packages"} icon={FlaskConical} label="Багц шинжилгээ" onClick={() => setSection("packages")} />
            <NavButton active={section === "labs"} icon={FlaskConical} label="Шинжилгээ attach" onClick={() => setSection("labs")} />
          </nav>
          <button type="button" className="mt-10 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-sky-100 hover:bg-white/10" onClick={logout}>
            <LogOut size={17} /> Гарах
          </button>
        </aside>

        <main className="min-w-0 bg-[#f8fbff]">
          <header className="flex flex-col gap-4 border-b border-slate-100 bg-white px-5 py-4 md:flex-row md:items-center md:justify-between">
            <label className="flex h-11 max-w-xl flex-1 items-center gap-3 rounded-2xl bg-slate-100 px-4 text-slate-500">
              <Search size={18} />
              <input className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" placeholder="Эмч, өвчтөн, захиалга хайх" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <div className="rounded-2xl bg-[#0875c9] px-4 py-3 text-sm font-bold text-white">
              {data.hospital.district} · {data.hospital.rating.toFixed(1)}
            </div>
          </header>

          <div className="p-5">
            {loading ? (
              <Panel>Байгууллагын мэдээлэл ачаалж байна...</Panel>
            ) : (
              <>
                {section === "overview" && (
                  <div className="grid gap-5">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                      <Stat label="Эмч" value={data.summary.doctors} icon={Stethoscope} />
                      <Stat label="Өвчтөн" value={data.summary.patients} icon={UsersRound} />
                      <Stat label="Захиалга" value={data.summary.appointments} icon={CalendarClock} />
                      <Stat label="Багц шинжилгээ" value={data.summary.packageOrders} icon={FlaskConical} />
                      <Stat label="Орлого" value={`${data.summary.revenue.toLocaleString("en-US")}₮`} icon={Activity} highlight />
                    </div>
                    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                      <Panel title="Сүүлийн захиалгууд">
                        <Rows rows={data.appointments.slice(0, 8).map((item) => [item.patientName, item.type === "PACKAGE_ORDER" ? "Багц шинжилгээ" : item.specialty, formatDate(item.scheduledAt), item.paymentStatus])} />
                      </Panel>
                      <Panel title="Багц шинжилгээ авсан хүмүүс">
                        <Rows rows={packageOrders.slice(0, 8).map((item) => [item.patientName, item.reason.replace("Багц шинжилгээ - ", ""), item.status])} />
                      </Panel>
                    </div>
                  </div>
                )}

                {section === "doctors" && (
                  <Panel title="Манай эмч нар">
                    <Rows rows={filteredDoctors.map((doctor) => [doctor.name, doctor.specialty, doctor.online ? "Active" : "Offline", `${doctor.appointments} цаг`])} empty="Эмч олдсонгүй" />
                  </Panel>
                )}

                {section === "patients" && (
                  <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
                    <Panel title="Өвчтөнүүд">
                      <Rows rows={filteredPatients.map((patient) => [patient.name, patient.phone || patient.email || "-", `${patient.totalOrders} захиалга`])} empty="Өвчтөн олдсонгүй" />
                    </Panel>
                    <Panel title="Байгууллагын захиалгууд">
                      <Rows rows={data.appointments.map((item) => [item.patientName, item.doctorName, item.type, formatDate(item.scheduledAt), item.status])} empty="Захиалга алга" />
                    </Panel>
                  </div>
                )}

                {section === "packages" && (
                  <div className="grid gap-5 xl:grid-cols-[440px_minmax(0,1fr)]">
                    <Panel title="Багц шинжилгээ нэмэх">
                      <form className="grid gap-3" onSubmit={createHealthPackage}>
                        <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none" placeholder="Багцын нэр" value={packageForm.name} onChange={(event) => setPackageForm((current) => ({ ...current, name: event.target.value }))} />
                        <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none" placeholder="Товч тайлбар" value={packageForm.description} onChange={(event) => setPackageForm((current) => ({ ...current, description: event.target.value }))} />
                        <textarea className="min-h-20 rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none" placeholder="Дэлгэрэнгүй summary" value={packageForm.summary} onChange={(event) => setPackageForm((current) => ({ ...current, summary: event.target.value }))} />
                        <div className="grid gap-3 sm:grid-cols-3">
                          <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none" inputMode="numeric" placeholder="Хуучин үнэ" value={packageForm.oldPrice} onChange={(event) => setPackageForm((current) => ({ ...current, oldPrice: event.target.value }))} />
                          <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none" inputMode="numeric" placeholder="Үнэ" value={packageForm.price} onChange={(event) => setPackageForm((current) => ({ ...current, price: event.target.value }))} />
                          <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none" placeholder="Хямдрал" value={packageForm.discount} onChange={(event) => setPackageForm((current) => ({ ...current, discount: event.target.value }))} />
                        </div>
                        <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none" placeholder="Лабораторийн цаг" value={packageForm.labHours} onChange={(event) => setPackageForm((current) => ({ ...current, labHours: event.target.value }))} />
                        <textarea className="min-h-48 rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none" placeholder="Шинжилгээнүүд" value={packageForm.testsText} onChange={(event) => setPackageForm((current) => ({ ...current, testsText: event.target.value }))} />
                        {notice && <p className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-[#0875c9]">{notice}</p>}
                        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0875c9] px-4 text-sm font-extrabold text-white hover:bg-[#075fa4]" disabled={savingPackage}>
                          <FilePlus2 size={17} /> {savingPackage ? "Нэмж байна..." : "Багц нэмэх"}
                        </button>
                      </form>
                    </Panel>
                    <Panel title="Оруулсан багц шинжилгээнүүд">
                      <Rows rows={data.healthPackages.map((item) => [item.name, `${item.price.toLocaleString("en-US")}₮`, item.active ? "Идэвхтэй" : "Нуугдсан", `${item.tests.length} төрөл`])} empty="Багц шинжилгээ алга" />
                    </Panel>
                  </div>
                )}

                {section === "labs" && (
                  <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
                    <Panel title="Шинжилгээний хариу attach хийх">
                      <form className="grid gap-3" onSubmit={createLabResult}>
                        <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none" value={selectedPatientId} onChange={(event) => setSelectedPatientId(event.target.value)}>
                          {data.patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name}</option>)}
                        </select>
                        <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none" placeholder="Шинжилгээний нэр" value={labTitle} onChange={(event) => setLabTitle(event.target.value)} />
                        <textarea className="min-h-28 rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none" placeholder="Дүгнэлт / тайлбар" value={labSummary} onChange={(event) => setLabSummary(event.target.value)} />
                        <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none" placeholder="PDF/image URL байвал оруулах" value={labFileUrl} onChange={(event) => setLabFileUrl(event.target.value)} />
                        {notice && <p className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-[#0875c9]">{notice}</p>}
                        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0875c9] px-4 text-sm font-extrabold text-white hover:bg-[#075fa4]" disabled={savingLab}>
                          <FilePlus2 size={17} /> {savingLab ? "Нэмж байна..." : "Attach result"}
                        </button>
                      </form>
                    </Panel>
                    <Panel title="Илгээсэн шинжилгээний хариунууд">
                      <Rows rows={data.labResults.map((item) => [item.patientName, item.title, item.code, formatDate(item.issuedAt)])} empty="Шинжилгээний хариу алга" />
                    </Panel>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </section>
  );
}

function NavButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof LayoutDashboard; label: string; onClick: () => void }) {
  return (
    <button type="button" className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${active ? "bg-white text-[#0875c9]" : "text-sky-100 hover:bg-white/10"}`} onClick={onClick}>
      <Icon size={18} /> {label}
    </button>
  );
}

function Stat({ label, value, icon: Icon, highlight }: { label: string; value: number | string; icon: typeof Activity; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-sm ${highlight ? "bg-[#0875c9] text-white" : ""}`}>
      <div className="flex items-center justify-between">
        <p className={`text-sm font-bold ${highlight ? "text-sky-100" : "text-slate-500"}`}>{label}</p>
        <Icon size={19} className={highlight ? "text-white" : "text-[#0875c9]"} />
      </div>
      <p className="mt-4 text-2xl font-black">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      {title && <h2 className="mb-4 text-lg font-black text-slate-950">{title}</h2>}
      {children}
    </div>
  );
}

function Rows({ rows, empty = "Мэдээлэл алга" }: { rows: Array<Array<string | number>>; empty?: string }) {
  if (!rows.length) return <p className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-400">{empty}</p>;
  return (
    <div className="grid gap-2">
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700 md:grid-cols-4">
          {row.map((cell, cellIndex) => <span key={cellIndex} className={cellIndex === 0 ? "font-black text-slate-950" : ""}>{cell}</span>)}
        </div>
      ))}
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function parsePackageTests(value: string) {
  const blocks = value.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const title = lines[0] || "Шинжилгээ";
    const tests = lines.filter((line) => line.startsWith("-")).map((line) => line.replace(/^-\s*/, ""));
    const importanceLine = lines.find((line) => line.toLowerCase().startsWith("ач холбогдол"));
    return {
      title,
      tests: tests.length ? tests : lines.slice(1).filter((line) => !line.toLowerCase().startsWith("ач холбогдол")),
      importance: importanceLine?.replace(/^Ач холбогдол:\s*/i, "") || "Эрүүл мэндийн эрсдэлийг үнэлэхэд ашиглана.",
    };
  }).filter((item) => item.title && item.tests.length);
}
