import { HttpError } from "../middleware/errors.js";

export interface AssistantMessage { message: string; language: "ar" | "en" }
export function assistantMessage(body: unknown): AssistantMessage {
  const invalid = () => new HttpError(400, "INVALID_ASSISTANT_MESSAGE", "Provide a message of 1–2000 characters and language ar or en only.");
  if (!body || typeof body !== "object" || Array.isArray(body)) throw invalid();
  const data = body as Record<string, unknown>;
  if (Object.keys(data).some(key => !["message", "language"].includes(key)) ||
      typeof data.message !== "string" || (data.language !== "ar" && data.language !== "en")) throw invalid();
  const message = data.message.trim();
  if (!message || data.message.length > 2000 || [...message].some(char => {
    const code = char.charCodeAt(0); return code === 127 || (code < 32 && ![9, 10, 13].includes(code));
  })) throw invalid();
  return { message, language: data.language as AssistantMessage["language"] };
}

export const assistantSafety = {
  ar: {
    disclaimer: "هذه معلومات صحية تعليمية عامة، وليست تشخيصًا أو وصفة طبية أو بديلًا عن تقييم مختص. لا تغيّر علاجك اعتمادًا عليها.",
    emergencyGuidance: "إذا كانت لديك أعراض شديدة أو مفاجئة أو تعتقد أن هناك خطرًا على حياتك، فاتصل بخدمات الطوارئ المحلية فورًا. لا تنتظر رد المساعد.",
  },
  en: {
    disclaimer: "This is general health education, not a diagnosis, prescription, or substitute for professional assessment. Do not change treatment based on it.",
    emergencyGuidance: "For severe or sudden symptoms, or if you believe your life is in danger, contact local emergency services immediately. Do not wait for the assistant.",
  },
} as const;
