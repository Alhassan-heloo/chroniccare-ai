import ts from "typescript";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import assert from "node:assert/strict";

const root = fileURLToPath(new URL("../src/", import.meta.url));
function readCatalog(source) {
  const entries = new Map();
  const file = ts.createSourceFile("catalog.ts", source, ts.ScriptTarget.Latest, true);
  function visit(node, prefix = "") {
    if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))) {
      const path = prefix ? `${prefix}.${node.name.text}` : node.name.text;
      if (ts.isStringLiteral(node.initializer)) entries.set(path, node.initializer.text);
      else ts.forEachChild(node.initializer, (child) => visit(child, path));
    } else ts.forEachChild(node, (child) => visit(child, prefix));
  }
  visit(file);
  return entries;
}
const ar = readCatalog(await readFile(join(root, "i18n/locales/ar.ts"), "utf8"));
const en = readCatalog(await readFile(join(root, "i18n/locales/en.ts"), "utf8"));
assert.deepEqual([...ar.keys()].sort(), [...en.keys()].sort(), "Catalog key parity");
const names = (value) => [...new Set([...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]))].sort();
for (const [key, value] of ar) {
  const english = en.get(key);
  assert.deepEqual(names(value), names(english), `Placeholder parity: ${key}`);
  for (const text of [value, english]) assert(!/[{}]/.test(text.replace(/\{\{\w+\}\}/g, "")), `Malformed placeholder: ${key}`);
}
const used = new Set();
const dynamic = [];
const missing = [];
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (path !== join(root, "i18n")) await scan(path);
    } else if (/\.tsx?$/.test(entry.name)) {
      const source = await readFile(path, "utf8");
      const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
      function visit(node) {
        const call = ts.isCallExpression(node) ? node.expression : undefined;
        const direct = call && ts.isIdentifier(call) && call.text === "t";
        const adapter = call && ts.isPropertyAccessExpression(call) && ts.isIdentifier(call.expression) &&
          ((call.expression.text === "i18n" && call.name.text === "t") || (call.expression.text === "l" && call.name.text === "message"));
        if (ts.isCallExpression(node) && (direct || adapter)) {
          const argument = node.arguments[0];
          if (argument && ts.isStringLiteralLike(argument)) {
            if (ar.has(argument.text)) used.add(argument.text);
            else if (/^[a-z]+\.[\w.]+$/.test(argument.text)) missing.push(`${path}: ${argument.text}`);
          } else dynamic.push(path);
        }
        ts.forEachChild(node, visit);
      }
      visit(file);
    }
  }
}
await scan(root);
assert.deepEqual(missing, [], "Unknown static translation keys");
console.log(`PASS: ${ar.size} matching keys and compatible placeholders.`);
console.log("Potentially unused keys (advisory; Phase A keys are not migrated yet):", [...ar.keys()].filter((key) => !used.has(key)));
console.log("Dynamic calls requiring manual review:", [...new Set(dynamic)]);
console.log("Scanner recognizes t(...), i18n.t(...) and the typed Living l.message(...) adapter; dynamic keys may cause false positives. No keys are deleted automatically.");
