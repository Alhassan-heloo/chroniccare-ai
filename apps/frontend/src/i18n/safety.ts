export function placeholders(message: string) {
  const names = [...message.matchAll(/\{\{(\w+)\}\}/g)].flatMap((match) => match[1] ? [match[1]] : []);
  const malformed = /[{}]/.test(message.replace(/\{\{\w+\}\}/g, ""));
  return { names: [...new Set(names)].sort(), malformed };
}

export function inspectMessage(message: string | undefined, variables: Readonly<Record<string, string | number>> = {}) {
  if (message === undefined) return ["missing-key"];
  const parsed = placeholders(message);
  return [
    ...(parsed.malformed ? ["malformed-placeholder"] : []),
    ...parsed.names.filter((name) => !Object.hasOwn(variables, name)).map((name) => `missing-value:${name}`),
  ];
}

const reported = new Set<string>();
export function reportTranslationIssue(key: string, issues: string[], development: boolean) {
  if (!development || !issues.length) return;
  const signature = `${key}:${issues.join(",")}`;
  if (reported.has(signature)) return;
  reported.add(signature);
  console.warn(`[i18n] ${signature}`);
}
