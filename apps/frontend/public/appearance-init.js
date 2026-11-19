// Runs before React; kept external so the same-origin server can retain script-src 'self'.
(() => {
  const mode = localStorage.getItem("cc-theme") || "system";
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  const language = localStorage.getItem("cc-language") === "en" ? "en" : "ar";
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
})();
