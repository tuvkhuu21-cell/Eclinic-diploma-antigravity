import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, ok, options } from "@/lib/response";

export const runtime = "nodejs";

const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL_PATTERN = /^[a-zA-Z0-9._:-]+$/;

const requestSchema = z.object({
  message: z.string().trim().min(1, "message is required").max(2000),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(4000),
  })).optional().default([]),
});

type GroqResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

function getGroqModel() {
  const rawModel = process.env.GROQ_MODEL?.trim().replace(/^["']|["']$/g, "");
  if (!rawModel || !GROQ_MODEL_PATTERN.test(rawModel)) return DEFAULT_GROQ_MODEL;
  return rawModel;
}

function buildSystemPrompt(context: string) {
  return `Чи MediConnect-ийн AI туслах. Монгол хэлээр энгийн, ойлгомжтой, найрсаг хариул.

Үүрэг:
- Эрүүл мэндийн мэдээллийг ерөнхий байдлаар тайлбарла.
- Шинж тэмдэг хэлвэл тохирох эмчийн нарийн мэргэжлийг санал болго.
- Шинжилгээний нэр томьёог энгийнээр тайлбарла.
- MediConnect дээр эмч хайх, цаг захиалах, шинжилгээний хариу харах зэрэгт чиглүүл.
- Эцсийн онош тавьж болохгүй.
- Эмийн тун, жор, эмчилгээний нарийн заавар бичиж болохгүй.
- Эрүүл мэндийн зөвлөгөө өгсөн бол заавал богиноор оруул: "Энэ нь эмчийн онош биш. Ноцтой шинж тэмдэг илэрвэл эмчид хандана уу."

Яаралтай шинж тэмдэг: цээжээр хүчтэй өвдөх, амьсгал маш давчдах, харвалтын шинж, ухаан алдах, их цус алдах, хүчтэй харшлын урвал. Ийм шинж дурдагдвал цаг алдалгүй яаралтай тусламж авахыг зөвлө.

MediConnect-ийн одоогийн лавлах мэдээлэл:
${context}`;
}

async function getMediConnectContext() {
  try {
    const [doctors, hospitals] = await Promise.all([
      prisma.doctorProfile.findMany({
        take: 12,
        orderBy: [{ verified: "desc" }, { rating: "desc" }],
        include: {
          user: { select: { firstName: true, lastName: true } },
          hospital: { select: { name: true } },
        },
      }),
      prisma.hospital.findMany({
        take: 10,
        orderBy: { rating: "desc" },
        select: { name: true, type: true, district: true, address: true },
      }),
    ]);

    const doctorLines = doctors.map((doctor) => {
      const name = [doctor.user.lastName, doctor.user.firstName].filter(Boolean).join(" ");
      const hospital = doctor.hospital?.name ? `, ${doctor.hospital.name}` : "";
      return `- ${name}: ${doctor.specialty}, ${doctor.experience} жил, төлбөр ${doctor.fee || 30000}₮${hospital}`;
    });
    const hospitalLines = hospitals.map((hospital) => `- ${hospital.name}: ${hospital.type}, ${hospital.district}, ${hospital.address}`);

    return [
      doctorLines.length ? `Эмч нар:\n${doctorLines.join("\n")}` : "Эмчийн бүртгэл одоогоор хоосон байна.",
      hospitalLines.length ? `Эмнэлгүүд:\n${hospitalLines.join("\n")}` : "Эмнэлгийн бүртгэл одоогоор хоосон байна.",
    ].join("\n\n");
  } catch (error) {
    console.error("AI assistant context load failed", error);
    return "Лавлах мэдээллийг түр авах боломжгүй байна.";
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return fail("Invalid AI assistant request", 400, parsed.error.flatten());

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return fail("GROQ_API_KEY is missing", 500);

    const model = getGroqModel();
    const context = await getMediConnectContext();
    const response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: buildSystemPrompt(context) },
          ...parsed.data.history.slice(-10),
          { role: "user", content: parsed.data.message },
        ],
        temperature: 0.4,
        max_tokens: 700,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as GroqResponse;
    if (!response.ok) {
      console.error("Groq assistant request failed", { status: response.status, message: payload.error?.message || "Unknown Groq error" });
      return fail("AI assistant request failed", 502);
    }

    const reply = payload.choices?.[0]?.message?.content?.trim();
    if (!reply) return fail("AI assistant returned an empty response", 502);

    return ok({ reply });
  } catch (error) {
    console.error("AI assistant route error", error);
    return fail("AI assistant is temporarily unavailable", 500);
  }
}

export const OPTIONS = options;
