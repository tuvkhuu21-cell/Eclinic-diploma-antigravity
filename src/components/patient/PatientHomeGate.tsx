"use client";

import { useEffect, useState } from "react";
import { AppointmentFlowModal } from "@/components/appointments/AppointmentFlowModal";
import { FeatureCards } from "@/components/home/FeatureCards";
import { HeroSection } from "@/components/home/HeroSection";
import { HospitalSection } from "@/components/home/HospitalSection";
import { HowItWorks } from "@/components/home/HowItWorks";
import { PopularDoctors } from "@/components/home/PopularDoctors";
import { SearchSection } from "@/components/home/SearchSection";
import { PatientHome } from "./PatientHome";
import { useAuthStore } from "@/store/auth.store";
import { PublicAuthModal } from "@/components/auth/PublicAuthModal";

export function PatientHomeGate() {
  const { hasHydrated, token, role, user } = useAuthStore();
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("appointment") !== "select") return;
    if (hasHydrated && token) setAppointmentOpen(true);
    if (hasHydrated && !token) setAuthMode("login");
  }, [hasHydrated, token]);

  const isPatientHome = hasHydrated && token && (role === "PATIENT" || user?.role === "PATIENT");

  if (isPatientHome) return <PatientHome />;
  return (
    <>
      <HeroSection onRequireLogin={() => setAuthMode("login")} />
      <SearchSection />
      <FeatureCards />
      <PopularDoctors />
      <HospitalSection />
      <HowItWorks />
      <AppointmentFlowModal open={appointmentOpen} onClose={() => setAppointmentOpen(false)} />
      <PublicAuthModal mode={authMode} onClose={() => setAuthMode(null)} onModeChange={setAuthMode} />
    </>
  );
}
