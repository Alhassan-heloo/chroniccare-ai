import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function checkPwaFiles(page, origin, dist) {
  const request = page.context().request;
  const manifestLink = page.locator('link[rel="manifest"]');
  assert.equal(await manifestLink.getAttribute("href"), "/manifest.webmanifest");
  const manifestResponse = await request.get(origin + "/manifest.webmanifest");
  assert.equal(manifestResponse.status(), 200);
  assert.match(manifestResponse.headers()["content-type"], /^application\/manifest\+json\b/);
  const manifest = await manifestResponse.json();
  assert.deepEqual(manifest, JSON.parse(await readFile(resolve(dist, "manifest.webmanifest"), "utf8")));
  assert.equal(manifest.name, "ChronicCare AI");
  for (const field of ["id", "start_url", "scope"]) assert.equal(manifest[field], "/");
  assert.equal(manifest.display, "standalone");
  assert.deepEqual(manifest.icons.map(icon => icon.sizes), ["192x192", "512x512"]);
  assert(manifest.icons.every(icon => icon.purpose.split(" ").includes("maskable")));

  const appleLink = page.locator('link[rel="apple-touch-icon"]');
  const icons = [...manifest.icons, { src: await appleLink.getAttribute("href"), sizes: await appleLink.getAttribute("sizes") }];
  assert.equal(icons[2].sizes, "180x180");
  for (const icon of icons) {
    const response = await request.get(new URL(icon.src, origin).href);
    assert.equal(response.status(), 200);
    assert.match(response.headers()["content-type"], /^image\/png\b/);
    const png = await response.body();
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16) + "x" + png.readUInt32BE(20), icon.sizes);
    assert.deepEqual(png, await readFile(resolve(dist, "." + icon.src)));
  }

  const cdp = await page.context().newCDPSession(page);
  const parsed = await cdp.send("Page.getAppManifest");
  assert.equal(parsed.url, origin + "/manifest.webmanifest");
  assert.deepEqual(parsed.errors, []);
  await cdp.detach();
}

export async function readChromiumInstallability(chromium, profile, origin) {
  // A normal throwaway profile avoids the incognito installability restriction.
  const context = await chromium.launchPersistentContext(profile, { channel: "msedge", headless: true, ignoreHTTPSErrors: true });
  try {
    await context.addInitScript(() => {
      window.addEventListener("beforeinstallprompt", event => {
        window.browserOfferedInstall = event.isTrusted && typeof event.prompt === "function";
      });
    });
    const page = context.pages()[0];
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.locator(".hy-brand").first().waitFor();
    const cdp = await context.newCDPSession(page);
    const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
    return {
      errors: installabilityErrors.map(error => error.errorId),
      nativePromptEventObserved: Boolean(await page.evaluate(() => window.browserOfferedInstall)),
    };
  } finally {
    await context.close();
  }
}

export async function checkPwaStates(browser, origin, check, report) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 320, height: 640 }, reducedMotion: "reduce" });
  try {
    await context.exposeFunction("recordPwaCspViolation", details => { report.cspViolations.push(details); });
    await context.addInitScript(() => {
      localStorage.setItem("cc-language", "en");
      document.addEventListener("securitypolicyviolation", event => {
        void window.recordPwaCspViolation({ directive: event.violatedDirective, blockedURI: event.blockedURI });
      });
      // Keep emulated UI scenarios deterministic if the real browser offers its own prompt.
      window.addEventListener("beforeinstallprompt", event => {
        if (event.isTrusted) { event.preventDefault(); event.stopImmediatePropagation(); }
      }, { capture: true });
    });
    const page = await context.newPage();
    page.on("pageerror", error => { report.errors.push(error.message); });
    const openMenu = async () => {
      await page.locator("#hy-menu-button").click();
      await page.locator("#hy-menu").waitFor();
    };
    const section = page.locator("#hy-menu .phone-install");
    const install = section.getByRole("button", { name: "Install app", exact: true });
    const expandInstall = async () => {
      if (await section.getAttribute("open") === null) await section.locator("summary").click();
    };
    const showInstructions = async () => {
      await expandInstall();
      await section.getByText("Android · Chrome").waitFor();
      await section.getByText("iPhone · Safari").waitFor();
      assert.equal(await install.count(), 0);
    };
    const offer = async () => page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true });
      event.prompt = () => {
        window.testPromptCalls = (window.testPromptCalls ?? 0) + 1;
        return new Promise(resolve => { window.finishTestPrompt = resolve; });
      };
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    const loadHome = () => page.goto(origin, { waitUntil: "domcontentloaded" });
    await loadHome();
    await openMenu();
    assert.equal(await section.locator("summary").innerText(), "Install on your phone");
    await showInstructions();
    assert(await section.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#hy-menu").isVisible(), false);
    check("Chromium mobile viewport: manual Chrome and Safari paths, English labels, 320px fit and Escape");

    assert.equal(await offer(), true);
    await openMenu();
    await expandInstall();
    await install.waitFor();
    assert.equal(await page.evaluate(() => window.testPromptCalls ?? 0), 0);
    await install.click();
    assert.equal(await install.isDisabled(), true);
    await page.evaluate(() => window.finishTestPrompt({ outcome: "dismissed" }));
    await section.getByRole("status").getByText(/Installation cancelled/).waitFor();
    await offer();
    assert.equal(await install.count(), 0);
    assert.equal(await page.evaluate(() => window.testPromptCalls), 1);
    await page.reload({ waitUntil: "domcontentloaded" });
    await openMenu();
    await showInstructions();
    await offer();
    assert.equal(await install.count(), 0);
    check("Simulated browser prompt is user-initiated and single-use, with dismissal suppression across reload");

    await page.evaluate(() => sessionStorage.removeItem("cc-install-dismissed"));
    await loadHome();
    await offer();
    await openMenu();
    await expandInstall();
    await install.click();
    await page.evaluate(() => window.finishTestPrompt({ outcome: "accepted" }));
    await section.waitFor({ state: "detached" });
    check("Simulated prompt acceptance hides the install option");

    const standalone = await context.newPage();
    await standalone.addInitScript(() => {
      Object.defineProperty(navigator, "standalone", { value: true });
    });
    await standalone.goto(origin, { waitUntil: "domcontentloaded" });
    await standalone.locator("#hy-menu-button").click();
    await standalone.locator("#hy-menu").waitFor();
    assert.equal(await standalone.locator("#hy-menu .phone-install").count(), 0);
    const displayMode = await context.newPage();
    await displayMode.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = query => query === "(display-mode: standalone)"
        ? { matches: true, addEventListener() {} } : original(query);
    });
    await displayMode.goto(origin, { waitUntil: "domcontentloaded" });
    await displayMode.locator("#hy-menu-button").click();
    await displayMode.locator("#hy-menu").waitFor();
    assert.equal(await displayMode.locator("#hy-menu .phone-install").count(), 0);
    check("Simulated iPhone standalone and standalone display mode both hide the install option");

    await loadHome();
    await openMenu();
    await section.locator("summary").waitFor();
    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    await section.waitFor({ state: "detached" });
    check("Browser appinstalled event also hides the install option");
  } finally {
    await context.close();
  }
}
