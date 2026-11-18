import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const dir = await mkdtemp(join(tmpdir(), "chronic-smoke-"));
try {
  const outfile = join(dir, "smoke.mjs");
  await build({
    absWorkingDir: root,
    entryPoints: [join(root, "scripts", "smoke.tsx")],
    bundle: true,
    loader: { ".jpg": "file", ".woff2": "file" },
    platform: "node",
    format: "esm",
    banner: {
      js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    },
    outfile,
    tsconfig: join(root, "tsconfig.app.json"),
    logLevel: "warning",
  });
  await import(pathToFileURL(outfile).href);
} finally {
  await rm(dir, { recursive: true, force: true });
}
