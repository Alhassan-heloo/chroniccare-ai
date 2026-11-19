import axios from "axios";
import { apiBaseUrl } from "./baseUrl";
export const apiClient = axios.create({
  baseURL: apiBaseUrl,
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
