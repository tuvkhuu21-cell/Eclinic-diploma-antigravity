import { api } from "./api";
export const aiService = {
  ask: (data: unknown) => api.post("/ai/ask", data),
  assistant: (data: unknown) => api.post("/ai/assistant", data),
  tools: () => api.get("/ai/tools"),
};

