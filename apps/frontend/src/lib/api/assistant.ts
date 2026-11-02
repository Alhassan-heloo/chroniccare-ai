import { AuthError, type AuthorizedRequest } from "@/auth/api";
export interface AssistantReply { reply: string; language: "ar" | "en"; disclaimer: string; emergencyGuidance: string }
export async function sendAssistantMessage(request: AuthorizedRequest, message: string, language: "ar" | "en", signal?: AbortSignal): Promise<AssistantReply> {
  if (!message.trim() || message.length > 2000) throw new AuthError("INVALID_ASSISTANT_MESSAGE");
  const response = await request<unknown>("/assistant/messages", { body: { message: message.trim(), language }, signal });
  if (!response || typeof response !== "object" || !("data" in response) || !response.data || typeof response.data !== "object" || Array.isArray(response.data)) throw new AuthError("INVALID_RESPONSE");
  const data = response.data as Record<string, unknown>;
  if (Object.keys(data).some(key => !["reply", "language", "disclaimer", "emergencyGuidance"].includes(key)) || data.language !== language ||
      typeof data.reply !== "string" || !data.reply.trim() || data.reply.length > 6000 ||
      typeof data.disclaimer !== "string" || !data.disclaimer.trim() || data.disclaimer.length > 4000 ||
      typeof data.emergencyGuidance !== "string" || !data.emergencyGuidance.trim() || data.emergencyGuidance.length > 4000) throw new AuthError("INVALID_RESPONSE");
  return data as unknown as AssistantReply;
}
