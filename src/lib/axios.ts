import axios from "axios";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
const normalizedBaseUrl = typeof window !== "undefined"
  ? "/api"
  : apiBaseUrl
    ? (apiBaseUrl.endsWith("/api") ? apiBaseUrl : `${apiBaseUrl.replace(/\/$/, "")}/api`)
    : "/api";

export const apiClient = axios.create({
  baseURL: normalizedBaseUrl,
  timeout: 10000,
});

const pendingGets = new Map<string, ReturnType<typeof apiClient.get>>();
const originalGet = apiClient.get.bind(apiClient);

apiClient.get = ((url: string, config = {}) => {
  const key = `${url}?${JSON.stringify(config.params || {})}`;
  const existing = pendingGets.get(key);
  if (existing) return existing;
  const request = originalGet(url, config).finally(() => pendingGets.delete(key));
  pendingGets.set(key, request);
  return request;
}) as typeof apiClient.get;

apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("mediconnect_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
