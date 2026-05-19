import { cn } from "@/lib/utils";
import { Paperclip, Video } from "lucide-react";

type AttachmentPayload = {
  type?: string;
  text?: string;
  endedAt?: string;
  durationSeconds?: number;
  attachment?: {
    url: string;
    name: string;
    mimeType?: string;
    size?: number;
  };
};

export function MessageBubble({ mine, text, status }: { mine?: boolean; text: string; status?: "sending" | "failed" }) {
  const payload = parsePayload(text);
  const bodyText = payload?.text ?? text;
  const attachment = payload?.attachment;
  const isImage = attachment?.mimeType?.startsWith("image/");
  if (payload?.type === "video-call-ended") {
    return (
      <div className={cn("flex w-full", mine ? "justify-end" : "justify-start")}>
        <div className="my-3 w-full max-w-[310px] rounded-[28px] bg-[#f0f0f0] p-4 text-slate-950 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-200 text-slate-950">
              <Video size={23} />
            </span>
            <div>
              <p className="text-xl font-extrabold leading-6">Video call</p>
              <p className="text-base font-semibold text-slate-500">{formatCallSubtitle(payload)}</p>
            </div>
          </div>
          <button type="button" className="mt-3 h-12 w-full rounded-xl bg-slate-200 text-lg font-semibold text-slate-950 transition hover:bg-slate-300">
            Call again
          </button>
        </div>
      </div>
    );
  }
  if (attachment && isImage) {
    return (
      <div className={cn("flex w-full flex-col gap-1.5", mine ? "items-end" : "items-start")}>
        <a href={attachment.url} target="_blank" rel="noreferrer" className="block max-w-[min(72%,560px)] overflow-hidden rounded-[18px] bg-slate-100 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={attachment.url} alt={attachment.name} className="block max-h-[420px] w-full object-contain" />
        </a>
        {bodyText && (
          <div className={cn("max-w-[72%] rounded-[20px] px-4 py-2.5 text-[15px] leading-5 shadow-sm", mine ? "rounded-br-md bg-[#0084ff] text-white" : "rounded-bl-md bg-[#f0f2f5] text-slate-950")}>
            <p>{bodyText}</p>
          </div>
        )}
        {status === "sending" && <p className="px-2 text-[11px] font-semibold text-slate-400">Илгээж байна...</p>}
        {status === "failed" && <p className="px-2 text-[11px] font-bold text-rose-500">Илгээхэд алдаа гарлаа</p>}
      </div>
    );
  }
  return (
    <div className={cn("flex w-full", mine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[72%] rounded-[20px] px-4 py-2.5 text-[15px] leading-5 shadow-sm", mine ? "rounded-br-md bg-[#0084ff] text-white" : "rounded-bl-md bg-[#f0f2f5] text-slate-950")}>
        {bodyText && <p>{bodyText}</p>}
        {attachment && (
          <a href={attachment.url} target="_blank" rel="noreferrer" className={cn("mt-2 flex items-center gap-3 rounded-2xl border px-3 py-2", mine ? "border-white/30 bg-white/10 text-white" : "border-slate-200 bg-white text-slate-950")}>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600"><Paperclip size={16} /></span>
            <span className={cn("min-w-0 truncate text-xs font-bold", mine ? "text-white" : "text-medical")}>{attachment.name}</span>
          </a>
        )}
        {status === "sending" && <p className={cn("mt-1 text-[11px] font-semibold", mine ? "text-white/70" : "text-slate-400")}>Илгээж байна...</p>}
        {status === "failed" && <p className="mt-1 text-[11px] font-bold text-rose-500">Илгээхэд алдаа гарлаа</p>}
      </div>
    </div>
  );
}

function parsePayload(value: string): AttachmentPayload | null {
  try {
    const parsed = JSON.parse(value) as AttachmentPayload;
    if (parsed && typeof parsed === "object" && (parsed.attachment?.url || parsed.type === "video-call-ended")) return parsed;
    return null;
  } catch {
    return null;
  }
}

function formatCallSubtitle(payload: AttachmentPayload) {
  if (payload.durationSeconds && payload.durationSeconds > 0) return `${payload.durationSeconds} secs`;
  if (payload.endedAt) return `Ended at ${formatClock(new Date(payload.endedAt))}`;
  return payload.text?.replace(/^Видео дуудлага дууслаа\s*·\s*/, "") || "Ended";
}

function formatClock(date: Date) {
  if (Number.isNaN(date.getTime())) return "";
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${period}`;
}
