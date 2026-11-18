// @ts-check

/** @param {string} applicationOrigin */
export function seedApplicationPreferences(applicationOrigin) {
  // Playwright evaluates this function on each new document, including blank pages.
  if (location.origin !== applicationOrigin) return;
  localStorage.setItem("cc-language", "en");
  localStorage.setItem("cc-theme", "dark");
  localStorage.setItem("cc-public-motion", "paused");
}

/** @param {{ page: { close(): Promise<void> }, context: { cookies(url: string): Promise<{ name: string, value: string }[]> },
 * api: string, waitForIdle(): Promise<void>, assertIdle(): void, armBackend(): Promise<void>, drainBackend(): Promise<void> }} options */
export async function closeDoctorPageForRestart({ page, context, api, waitForIdle, assertIdle, armBackend, drainBackend }) {
  const before = (await context.cookies(api)).find(cookie => cookie.name === "cc_session");
  if (!before?.value) throw new Error("Doctor session cookie required before restart");
  await waitForIdle();
  await armBackend();
  // The IPC round trip can admit a new poll while the old page is still alive.
  assertIdle();
  await page.close();
  const after = (await context.cookies(api)).find(cookie => cookie.name === "cc_session");
  if (after?.value !== before.value) throw new Error("Closing the page changed the doctor session cookie");
  await drainBackend();
}
