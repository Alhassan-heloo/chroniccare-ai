import { en } from "./translations";

const replacements = Object.entries(en).sort(([a], [b]) => b.length - a.length);
const hasArabic = /[\u0600-\u06ff]/;

export function translateToEnglish(value: string) {
  if (!hasArabic.test(value)) return value;
  const normalized = value.replace(/\s+/g, " ").trim();
  return en[normalized] ?? replacements.reduce(
    (text, [arabic, english]) => text.split(arabic).join(english),
    normalized,
  );
}
