import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postcss from 'postcss';

const css = await readFile(new URL('../src/styles/living-public.css', import.meta.url), 'utf8');
const ast = postcss.parse(css);
ast.walkRules(rule => {
  let parent = rule.parent;
  while (parent) { if (parent.type === 'atrule' && parent.name.endsWith('keyframes')) return; parent = parent.parent; }
  assert(rule.selector.trim(), 'No empty selectors');
  for (const selector of rule.selectors) assert(selector.includes('.living-public'), `Unscoped rule: ${selector}`);
});
assert(!/overflow-x\s*:\s*hidden/.test(css), 'Do not conceal overflow globally');
assert(/\.living-public \.overline\s*\{\s*text-decoration:none/.test(css), 'Neutralize the existing Tailwind overline utility within Living only');
const light = await readFile(new URL('../src/components/public/living/useLivingMotion.ts', import.meta.url), 'utf8');
assert(light.includes("light.style.setProperty('--light-x'"));
assert(!light.includes("node.style.setProperty('--light-x'"));
assert(light.includes('cancelAnimationFrame(frame)'));
const presentation = await readFile(new URL('../src/components/public/living/presentation.ts', import.meta.url), 'utf8');
assert(presentation.includes('useI18n()') && presentation.includes('i18n.formatDate') && !presentation.includes('new Intl'));
console.log('PASS: scoped tokens/styles, localized formatters and isolated Canvas light invalidation.');
