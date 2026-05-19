"use client";

import { useState } from "react";
import { Bot, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AiToolResultCard } from "./AiToolResultCard";
import { aiService } from "@/services/ai.service";

type AiMessage = {
  role: "assistant" | "user";
  content: string;
};

type AiAssistantResponse = {
  success: boolean;
  data?: {
    reply?: string;
  };
};

export function AiChatPanel() {
  const [messages, setMessages] = useState<AiMessage[]>([
    {
      role: "assistant",
      content: "Сайн байна уу? Шинж тэмдэг, эмч, эмнэлэг, цаг захиалга эсвэл шинжилгээний талаар асуугаарай.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    const message = draft.trim();
    if (!message || loading) return;
    setDraft("");
    setMessages((current) => [...current, { role: "user", content: message }]);
    setLoading(true);
    try {
      const history = messages.map((item) => ({ role: item.role, content: item.content })).slice(-10);
      const response = await aiService.assistant({ message, history });
      const payload = response.data as AiAssistantResponse;
      const answer = payload.data?.reply || "Хариу авахад алдаа гарлаа.";
      setMessages((current) => [...current, { role: "assistant", content: answer }]);
    } catch {
      setMessages((current) => [...current, { role: "assistant", content: "AI туслах түр хугацаанд ажиллахгүй байна." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-[380px] overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-[0_24px_80px_rgba(25,105,89,0.2)]">
      <div className="flex items-center gap-2 bg-medical p-4 text-white"><Bot size={20} /><div><h3 className="font-bold">Medi AI туслах</h3><p className="text-xs text-cyan-100">Groq healthcare assistant</p></div></div>
      <div className="grid max-h-[430px] gap-3 overflow-auto bg-[#f8fcfa] p-4 text-sm [scrollbar-color:#b7d8cd_transparent] [scrollbar-width:thin]">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 leading-6 shadow-sm ${message.role === "user" ? "ml-auto bg-medical text-white" : "bg-white text-slate-700"}`}>
            {message.content}
          </div>
        ))}
        {loading && <p className="w-fit rounded-2xl bg-white px-4 py-3 text-slate-500 shadow-sm">Бодож байна...</p>}
        <AiToolResultCard title="Санал болгох боломжтой" result="Эмч, эмнэлэг, шинж тэмдэг, цаг захиалга, шинжилгээний хариуны тухай асууж болно." />
      </div>
      <div className="flex gap-2 border-t border-emerald-100 p-3">
        <Input placeholder="AI туслахаас асуух" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void send(); }} disabled={loading} />
        <Button className="w-11 px-0" aria-label="Илгээх" onClick={() => void send()} disabled={loading || !draft.trim()}><Send size={17} /></Button>
      </div>
    </div>
  );
}
