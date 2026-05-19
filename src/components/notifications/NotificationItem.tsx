import { BellRing } from "lucide-react";
import { cn } from "@/lib/utils";

export function NotificationItem({
  title,
  description,
  time,
  unread,
  onClick,
}: {
  title: string;
  description: string;
  time: string;
  unread?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full gap-3 rounded-2xl border border-emerald-50 bg-white p-3 text-left shadow-[0_10px_26px_rgba(25,105,89,0.08)] transition hover:border-emerald-200 hover:bg-emerald-50/50"
    >
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cyanSoft text-medical", unread && "bg-medical text-white")}>
        <BellRing size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-bold leading-5 text-navy">{title}</h3>
          <span className="shrink-0 text-xs font-semibold text-slate-400">{time}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">{description}</p>
      </div>
    </button>
  );
}
