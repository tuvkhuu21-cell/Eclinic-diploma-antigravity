import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline";

export function Button({ className, variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles = {
    primary: "bg-medical text-white shadow-sm hover:bg-[#1d6758]",
    secondary: "bg-navy text-white hover:bg-[#0c2422]",
    ghost: "bg-transparent text-slate-700 hover:bg-emerald-50",
    outline: "border border-sky-200 bg-white text-navy hover:bg-cyanSoft",
  };
  return <button className={cn("inline-flex h-11 items-center justify-center rounded-2xl px-5 text-sm font-semibold transition disabled:opacity-60", styles[variant], className)} {...props} />;
}
