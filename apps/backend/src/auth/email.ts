export interface EmailMessage { to: string; subject: string; text: string }
export interface EmailDelivery { send(message: EmailMessage): Promise<void> }

// Configured by the operator, never by a public request. No SDK dependency.
export function configuredEmail(env: NodeJS.ProcessEnv = process.env): EmailDelivery | undefined {
  if (!env.EMAIL_PROVIDER) return undefined;
  if (env.EMAIL_PROVIDER !== "resend" || !env.EMAIL_API_KEY || !env.EMAIL_FROM) throw new Error("Invalid email provider configuration.");
  const key = env.EMAIL_API_KEY, from = env.EMAIL_FROM;
  return { async send(message) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
      signal: AbortSignal.timeout(10000), redirect: "error",
    });
    if (!response.ok) throw new Error("Email provider rejected delivery.");
    const result = await response.json() as { id?: unknown };
    if (typeof result.id !== "string" || !result.id) throw new Error("Email provider did not acknowledge delivery.");
  } };
}
