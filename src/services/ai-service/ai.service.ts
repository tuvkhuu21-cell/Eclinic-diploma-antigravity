import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import { aiTools, allowedToolsForRole } from "./ai.tools";

type GroqResponse = {
  choices?: Array<{
    message?: { content?: string };
  }>;
};

export const aiService = {
  tools: (role: string) => allowedToolsForRole(role),
  async ask(userId: string | null, role: string, data: { message: string; tool?: string }) {
    if (data.tool) {
      const tool = aiTools.find((item) => item.name === data.tool);
      if (!tool || !(tool.roles as readonly string[]).includes(role)) throw new ApiError(403, "AI tool not allowed for this role");
    }
    const healthcareContext = await buildHealthcareContext();
    const content = await askGroq(data.message, role, healthcareContext)
      .catch(() => fallbackAnswer(data.message, healthcareContext));
    if (!userId) return { answer: content, tools: allowedToolsForRole(role) };
    const conversation = await prisma.aiConversation.upsert({ where: { userId }, update: {}, create: { userId } });
    await prisma.aiMessage.create({ data: { conversationId: conversation.id, role: "USER", content: data.message } });
    const assistant = await prisma.aiMessage.create({ data: { conversationId: conversation.id, role: "ASSISTANT", content, toolName: data.tool } });
    return { answer: assistant.content, tools: allowedToolsForRole(role) };
  },
};

async function buildHealthcareContext() {
  const [doctors, hospitals] = await Promise.all([
    prisma.doctorProfile.findMany({
      take: 12,
      include: { user: true, hospital: true },
      orderBy: [{ verified: "desc" }, { rating: "desc" }, { experience: "desc" }],
    }),
    prisma.hospital.findMany({
      take: 10,
      include: { departments: true },
      orderBy: { rating: "desc" },
    }),
  ]);

  return {
    doctors: doctors.map((doctor) => ({
      id: doctor.id,
      name: `${doctor.user.lastName || ""} ${doctor.user.firstName}`.trim(),
      specialty: doctor.specialty,
      hospital: doctor.hospital?.name || "Эмнэлэг бүртгээгүй",
      experience: doctor.experience,
      fee: doctor.fee || 30000,
      online: doctor.online,
      supportsOnline: doctor.supportsOnline,
      supportsInPerson: doctor.supportsInPerson,
      rating: doctor.rating,
    })),
    hospitals: hospitals.map((hospital) => ({
      id: hospital.id,
      name: hospital.name,
      type: hospital.type,
      district: hospital.district,
      address: hospital.address,
      phone: hospital.phone,
      departments: hospital.departments.map((department) => department.name),
      rating: hospital.rating,
    })),
  };
}

async function askGroq(message: string, role: string, context: Awaited<ReturnType<typeof buildHealthcareContext>>) {
  const apiKey = process.env.GROQ_API_KEY || process.env.GROK_API_KEY;
  if (!apiKey) return fallbackAnswer(message, context);
  const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
  const system = [
    "Чи MediConnect-ийн Монгол хэлтэй healthcare AI туслах.",
    "Монгол хэлээр товч, ойлгомжтой, аюулгүй зөвлөгөө өг.",
    "Онош тавихгүй. Яаралтай шинж тэмдэг байвал 103 эсвэл яаралтай тусламжид хандахыг хэл.",
    "Хэрэглэгч эмч/эмнэлэг асуувал доорх DB context-оос тохирох эмч, эмнэлгийг санал болго.",
    "Цаг захиалах бол тухайн эмчийн specialty, online/in-person боломж, төлбөрийг дурд.",
    `User role: ${role}`,
    `Doctors JSON: ${JSON.stringify(context.doctors)}`,
    `Hospitals JSON: ${JSON.stringify(context.hospitals)}`,
  ].join("\n\n");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: message },
      ],
      temperature: 0.35,
      max_tokens: 700,
    }),
  });
  if (!response.ok) throw new Error(`Groq request failed: ${response.status}`);
  const data = await response.json() as GroqResponse;
  const text = data.choices?.[0]?.message?.content?.trim();
  return text || fallbackAnswer(message, context);
}

function fallbackAnswer(message: string, context: Awaited<ReturnType<typeof buildHealthcareContext>>) {
  const normalized = message.toLowerCase();
  const suggestedSpecialties = detectSpecialties(normalized);
  const matchedDoctors = context.doctors.filter((doctor) => {
    const haystack = `${doctor.name} ${doctor.specialty} ${doctor.hospital}`.toLowerCase();
    return suggestedSpecialties.includes(doctor.specialty) || normalized.split(/\s+/).some((word) => word.length > 2 && haystack.includes(word));
  }).slice(0, 3);
  const matchedHospitals = context.hospitals.filter((hospital) => {
    const haystack = `${hospital.name} ${hospital.type} ${hospital.district} ${hospital.departments.join(" ")}`.toLowerCase();
    return suggestedSpecialties.some((specialty) => haystack.includes(specialty.toLowerCase())) || normalized.split(/\s+/).some((word) => word.length > 2 && haystack.includes(word));
  }).slice(0, 3);

  if (matchedDoctors.length || matchedHospitals.length || suggestedSpecialties.length) {
    const doctorText = matchedDoctors.map((doctor) => `- ${doctor.name}, ${doctor.specialty}, ${doctor.hospital}, ${doctor.fee}₮`).join("\n");
    const hospitalText = matchedHospitals.map((hospital) => `- ${hospital.name}, ${hospital.district}, ${hospital.phone || "утас бүртгээгүй"}`).join("\n");
    const specialtyText = suggestedSpecialties.length ? `Таны бичсэн шинж тэмдэгт ойролцоогоор ${suggestedSpecialties.join(", ")} чиглэлийн эмч тохиромжтой байж болно.` : "";
    const safetyText = "Хэрэв өвдөлт гэнэт маш хүчтэй болсон, гар/хөл мэдээ алдах, хэл ээдрэх, хараа өөрчлөгдөх, бөөлжих, ухаан балартах шинж илэрвэл 103 эсвэл яаралтай тусламжид хандаарай.";
    return [specialtyText || "Таны асуултад ойролцоо дараах мэдээлэл байна:", doctorText ? `Санал болгох эмч:\n${doctorText}` : "", hospitalText ? `Санал болгох эмнэлэг:\n${hospitalText}` : "", safetyText].filter(Boolean).join("\n\n");
  }

  return "Та шинж тэмдэг, хэрэгтэй мэргэжил, эмнэлэг эсвэл шинжилгээний талаар асууж болно. Би бүртгэлтэй эмч/эмнэлгийн мэдээллээс тохирох санал гаргана. Хэрэв цээжээр хүчтэй өвдөх, амьсгал давчдах, ухаан балартах зэрэг яаралтай шинж илэрвэл 103 эсвэл яаралтай тусламжид шууд хандаарай.";
}

function detectSpecialties(normalized: string) {
  const rules: Array<{ keywords: string[]; specialties: string[] }> = [
    { keywords: ["толгой", "мигрень", "манарах", "толгой өвд", "мэдээ алдах"], specialties: ["Мэдрэл", "Дотор"] },
    { keywords: ["зүрх", "цээж", "даралт", "амьсгаа"], specialties: ["Зүрх судас", "Дотор"] },
    { keywords: ["арьс", "харш", "тууралт", "загат"], specialties: ["Арьс, харшил"] },
    { keywords: ["шүд", "буйл"], specialties: ["Шүд"] },
    { keywords: ["нүд", "хараа"], specialties: ["Нүд"] },
    { keywords: ["хүүхэд", "нярай"], specialties: ["Хүүхэд", "Нярай"] },
    { keywords: ["бөөр", "шээс"], specialties: ["Бөөр", "Дотор"] },
    { keywords: ["ходоод", "гэдэс", "элэг", "хоол боловсруулах"], specialties: ["Хоол боловсруулах эрхтэн судлал", "Дотор"] },
    { keywords: ["уушги", "ханиалга", "хоолой", "амьсгал"], specialties: ["Уушги", "Чих хамар хоолой"] },
    { keywords: ["сэтгэл", "нойр", "стресс", "айдас"], specialties: ["Сэтгэл зүйч", "Сэтгэц"] },
  ];
  const specialties = new Set<string>();
  for (const rule of rules) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) rule.specialties.forEach((specialty) => specialties.add(specialty));
  }
  return Array.from(specialties);
}
