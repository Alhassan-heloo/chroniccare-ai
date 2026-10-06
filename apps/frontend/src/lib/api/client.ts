import axios from "axios";
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
  timeout: 15_000,
  headers: { Accept: "application/json" },
});
apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) =>
    Promise.reject(
      new Error(
        axios.isAxiosError(error)
          ? "تعذر الاتصال بالخدمة. حاول مرة أخرى."
          : "حدث خطأ غير متوقع.",
      ),
    ),
);
