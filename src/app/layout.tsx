import type { Metadata } from "next";
import "./globals.css";
import { TopBar } from "@/components/layout/TopBar";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MobileNav } from "@/components/layout/MobileNav";
import { FloatingAssistant } from "@/components/ai/FloatingAssistant";
import { AuthHydrator } from "@/components/auth/AuthHydrator";
import { GlobalIncomingCallListener } from "@/components/video/GlobalIncomingCallListener";
import { UserPresenceTracker } from "@/components/presence/UserPresenceTracker";

export const metadata: Metadata = {
  title: "MediConnect - Онлайн эмнэлгийн платформ",
  description: "Эмч, эмнэлэг, цаг захиалга, зөвлөгөө, шинжилгээний хариуг нэг дор.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthHydrator />
        <UserPresenceTracker />
        <TopBar />
        <Navbar />
        <main className="min-h-screen">{children}</main>
        <Footer />
        <FloatingAssistant />
        <GlobalIncomingCallListener />
        <MobileNav />
      </body>
    </html>
  );
}
