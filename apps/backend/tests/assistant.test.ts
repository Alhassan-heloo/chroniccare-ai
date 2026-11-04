import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { once } from "node:events";
import { createApp } from "../src/app.js";
import { configuredAssistant, type AssistantProvider } from "../src/assistant/provider.js";
import { assistantMessage } from "../src/assistant/validation.js";
import type { AuthStore } from "../src/auth/store.js";
import { tokenHash } from "../src/auth/security.js";

const origin = "http://localhost:5173", csrf = "f".repeat(64);
const patient = "a".repeat(64), doctor = "b".repeat(64), admin = "c".repeat(64), other = "d".repeat(64);
const users = new Map([[tokenHash(patient), { id: "private-patient-one", name: "Private Name", email: "private@example.test", role: "patient" as const }],
  [tokenHash(other), { id: "private-patient-two", name: "Other Name", email: "other@example.test", role: "patient" as const }],
  [tokenHash(doctor), { id: "doctor", name: "Doctor", email: "doctor@example.test", role: "doctor" as const }],
  [tokenHash(admin), { id: "admin", name: "Admin", email: "admin@example.test", role: "admin" as const }]]);
const unused = async (): Promise<never> => { throw new Error("No account writes or record reads are allowed in these tests."); };
const auth: AuthStore = { createUser: unused, createSession: unused, findAccount: unused, deleteSession: unused,
  async sessionUser(hash) { return users.get(hash); } };
const result = (answer = "General educational information.") => ({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ answer }) }] }] });
const config = { OPENAI_API_KEY: "unit-test-not-a-real-key", OPENAI_MODEL: "unit-test-model" };

test("Groq Responses: configuration, stateless structured output, RBAC and safe failures", async t => {
  const groq = { AI_PROVIDER: "groq", GROQ_API_KEY: "test-only-groq-key", GROQ_MODEL: "openai/gpt-oss-120b" };
  assert.equal(configuredAssistant({ AI_PROVIDER: "groq", ...config }), undefined, "No silent fallback to OpenAI credentials");
  assert.throws(() => configuredAssistant({ AI_PROVIDER: "unknown", ...config }));
  for (const settings of [{ GROQ_TIMEOUT_MS: "999999" }, { GROQ_MAX_OUTPUT_TOKENS: "10000" }, { GROQ_MODEL: "https://untrusted.example" }]) {
    assert.throws(() => configuredAssistant({ ...groq, ...settings }));
  }
  let variant = "success", calls = 0;
  const request = await serve(t, configuredAssistant(groq, async (url, options) => {
    calls++;
    assert.equal(url, "https://api.groq.com/openai/v1/responses");
    assert.equal(new Headers(options.headers).get("Authorization"), "Bearer " + groq.GROQ_API_KEY);
    assert.equal(options.redirect, "error");
    const body = JSON.parse(String(options.body));
    assert.deepEqual(Object.keys(body).sort(), ["input", "instructions", "max_output_tokens", "model", "text"]);
    assert.equal(body.model, groq.GROQ_MODEL); assert.equal(body.max_output_tokens, 600);
    assert.deepEqual(body.input, [{ role: "user", content: "سؤال عام" }]);
    assert.match(body.instructions, /Never diagnose/); assert.match(body.instructions, /Language: Arabic/);
    assert.equal(body.text.format.type, "json_schema"); assert.equal(body.text.format.strict, true);
    if (variant === "network") throw new Error(groq.GROQ_API_KEY + " sensitive message");
    if (variant === "429" || variant === "500") return new Response(groq.GROQ_API_KEY, { status: Number(variant) });
    if (variant === "invalid") return Response.json({ status: "completed", output: [] });
    return Response.json({ ...result("معلومات تعليمية عامة."), output: [{ type: "reasoning", content: [{ type: "reasoning_text", text: "not exposed" }] }, ...result("معلومات تعليمية عامة.").output] });
  }));
  const body = { message: "سؤال عام", language: "ar" };
  assert.equal((await request(body, null)).status, 401);
  for (const role of [doctor, admin]) assert.equal((await request(body, role)).status, 403);
  assert.equal((await request(body, patient, { "X-CSRF-Token": "invalid" })).status, 403);
  assert.equal(calls, 0);
  const response = await request(body); assert.equal(response.status, 200);
  const json = await response.json() as {data: {reply:string; language:string}};
  assert.equal(json.data.reply, "معلومات تعليمية عامة."); assert.equal(json.data.language, "ar");
  for (variant of ["429", "500", "invalid", "network"]) {
    const failed = await request(body); assert.equal(failed.status, 502);
    const text = await failed.text(); assert(!text.includes(groq.GROQ_API_KEY)); assert(!text.includes("sensitive"));
  }
  assert.equal(calls, 5, "No automatic provider retries");
  const timeoutRequest = await serve(t, configuredAssistant({ ...groq, GROQ_TIMEOUT_MS: "1000" }, async (_url, options) => new Promise<Response>((_resolve, reject) => {
    options.signal!.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  })));
  assert.equal((await timeoutRequest(body)).status, 504);
});

async function serve(t: TestContext, provider?: AssistantProvider) {
  const server = createApp({ corsOrigins: [origin], authStore: auth, assistantProvider: provider, checkDatabase: unused,
    reportError: () => { throw new Error("Unexpected unhandled error."); },
  }).listen(0, "127.0.0.1");
  t.after(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
  await once(server, "listening"); const address = server.address(); assert(address && typeof address !== "string");
  return (body: unknown, token: string | null = patient, headers: Record<string, string> = {}) => fetch(`http://127.0.0.1:${address.port}/api/assistant/messages`, {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-CSRF-Token": csrf,
      Cookie: `cc_csrf=${csrf}${token ? "; cc_session=" + token : ""}`, ...headers }, body: JSON.stringify(body),
  });
}

test("assistant input and configuration are bounded and reject arbitrary context", () => {
  assert.equal(configuredAssistant({}), undefined);
  assert.equal(configuredAssistant({ OPENAI_API_KEY: config.OPENAI_API_KEY }), undefined);
  for (const settings of [{ OPENAI_TIMEOUT_MS: "999999" }, { OPENAI_MAX_OUTPUT_TOKENS: "10000" }, { OPENAI_MODEL: "https://untrusted.example" }]) {
    assert.throws(() => configuredAssistant({ ...config, ...settings }), /configuration/);
  }
  assert.deepEqual(assistantMessage({ message: "  معلومات عامة  ", language: "ar" }), { message: "معلومات عامة", language: "ar" });
  for (const value of [null, [], {}, { message: "", language: "ar" }, { message: "   ", language: "ar" },
    { message: "a".repeat(2001), language: "en" }, { message: "hello", language: "fr" },
    { message: "hello", language: { toString: "en" } }, { message: "hello\u0000", language: "en" },
    { message: "hello", language: "en", history: [] }, { message: "hello", language: "en", patientId: "other" },
    { message: "hello", language: "en", model: "expensive-model" }]) assert.throws(() => assistantMessage(value));
});

test("OpenAI transport: official Responses endpoint, structured output and minimal private payload", async () => {
  const sent: Record<string, unknown>[] = [];
  const provider = configuredAssistant(config, async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses"); assert.equal(options.method, "POST"); assert.equal(options.redirect, "error");
    assert.equal(new Headers(options.headers).get("Authorization"), "Bearer " + config.OPENAI_API_KEY);
    const body = JSON.parse(String(options.body)) as Record<string, unknown>; sent.push(body);
    assert.equal(body.model, config.OPENAI_MODEL); assert.equal(body.store, false); assert.equal(body.max_output_tokens, 600);
    assert.deepEqual(Object.keys(body).sort(), ["input", "instructions", "max_output_tokens", "model", "store", "text"]);
    assert.match(String(body.instructions), /Never diagnose/); assert.match(String(body.instructions), /Language: Arabic/);
    assert.deepEqual(body.text, { format: { type: "json_schema", name: "health_education", strict: true,
      schema: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"], additionalProperties: false } } });
    return Response.json(result("معلومات تعليمية عامة."));
  })!;
  assert.equal(await provider.reply({ message: "سؤال عام", language: "ar" }, new AbortController().signal), "معلومات تعليمية عامة.");
  assert.deepEqual(sent[0]!.input, [{ role: "user", content: "سؤال عام" }]);
});

test("authenticated Patient HTTP path preserves CSRF/RBAC and sends no account context", async t => {
  const sent: string[] = [];
  const request = await serve(t, configuredAssistant(config, async (_url, options) => { sent.push(String(options.body)); return Response.json(result()); }));
  const body = { message: "What is a balanced meal?", language: "en" };
  assert.equal((await request(body, null)).status, 401);
  assert.equal((await request(body, doctor)).status, 403);
  assert.equal((await request(body, admin)).status, 403);
  assert.equal((await request(body, "e".repeat(64))).status, 401);
  assert.equal((await request(body, patient, { "X-CSRF-Token": "incorrect" })).status, 403);
  assert.equal((await request(body, patient, { Origin: "https://untrusted.example" })).status, 403);
  assert.equal(sent.length, 0);
  const success = await request(body); assert.equal(success.status, 200); assert.equal(success.headers.get("cache-control"), "no-store");
  const data = await success.json() as { data: { reply: string; language: string; disclaimer: string; emergencyGuidance: string } };
  assert.deepEqual(Object.keys(data.data).sort(), ["disclaimer", "emergencyGuidance", "language", "reply"]);
  assert.match(data.data.disclaimer, /not a diagnosis/); assert.match(data.data.emergencyGuidance, /emergency services/);
  const second = await request({ message: "سؤال عام", language: "ar" }, other); assert.equal(second.status, 200);
  const arabic = await second.json() as typeof data; assert.equal(arabic.data.language, "ar"); assert.match(arabic.data.disclaimer, /ليست تشخيصًا/);
  assert.equal(sent.length, 2);
  for (const payload of sent) { assert(!payload.includes("private-patient")); assert(!payload.includes("@example.test")); assert(!payload.includes("Private Name")); }
  assert(!sent[1]!.includes(body.message), "There is no cross-patient history or conversation replay.");
});

test("missing configuration and invalid messages never generate a response", async t => {
  const request = await serve(t);
  assert.equal((await request({ message: "hello", language: "en", measurements: [] })).status, 400);
  const response = await request({ message: "hello", language: "en" }); assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: { code: "ASSISTANT_NOT_CONFIGURED", message: "The assistant is not configured." } });
});

test("provider errors, refusals, incomplete or malformed output have no fabricated answer or sensitive leaks", async t => {
  for (const variant of ["network", "unauthorized", "rate", "server", "malformed", "incomplete", "refusal", "empty", "oversized", "invalid-answer"]) {
    await t.test(variant, async sub => {
      let calls = 0;
      const request = await serve(sub, configuredAssistant(config, async () => {
        calls++;
        if (variant === "network") throw new Error("private conversation " + config.OPENAI_API_KEY);
        if (["unauthorized", "rate", "server"].includes(variant)) return new Response("private conversation " + config.OPENAI_API_KEY, { status: variant === "rate" ? 429 : variant === "server" ? 500 : 401 });
        if (variant === "malformed") return new Response("not JSON");
        if (variant === "incomplete") return Response.json({ ...result(), status: "incomplete" });
        if (variant === "refusal") return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "private details" }] }] });
        if (variant === "empty") return Response.json({ status: "completed", output: [] });
        if (variant === "oversized") return new Response("a".repeat(65537));
        return Response.json(result(""));
      }));
      const response = await request({ message: "General question", language: "en" });
      assert.equal(response.status, variant === "refusal" ? 422 : 502);
      const text = await response.text(); assert(!text.includes(config.OPENAI_API_KEY)); assert(!text.includes("private")); assert(!text.includes('"reply"'));
      assert.equal(calls, 1, "Provider failures are not automatically retried.");
    });
  }
});

test("provider deadline aborts requests and returns a safe timeout", async t => {
  let aborted = false;
  const provider = configuredAssistant({ ...config, OPENAI_TIMEOUT_MS: "1000" }, async (_url, options) => new Promise<Response>((_resolve, reject) => {
    options.signal!.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); }, { once: true });
  }));
  const request = await serve(t, provider);
  const response = await request({ message: "Question", language: "en" }); assert.equal(response.status, 504); assert(aborted);
  assert.equal((await response.json() as { error: { code: string } }).error.code, "ASSISTANT_TIMEOUT");
});

test("per-patient limits apply across requests while other Patients have independent quotas", async t => {
  let calls = 0;
  const request = await serve(t, { async reply() { calls++; return "Education only."; } });
  const body = { message: "Question", language: "en" };
  for (let n = 0; n < 5; n++) assert.equal((await request(body)).status, 200);
  assert.equal((await request(body)).status, 429); assert.equal(calls, 5);
  assert.equal((await request(body, other)).status, 200); assert.equal(calls, 6);
});

test("concurrent duplicate submissions are rejected and locks release after confirmation", async t => {
  let unblock!: () => void, started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const wait = new Promise<void>(resolve => { unblock = resolve; });
  const request = await serve(t, { async reply() { started(); await wait; return "Education only."; } });
  const body = { message: "Question", language: "en" };
  const first = request(body); await ready;
  try { const repeated = await request(body); assert.equal(repeated.status, 429); assert.equal((await repeated.json() as { error: { code: string } }).error.code, "ASSISTANT_BUSY"); }
  finally { unblock(); }
  assert.equal((await first).status, 200);
  assert.equal((await request(body)).status, 200);
});
