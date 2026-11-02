// Evidence of runtime reachability, not a replacement for npm audit.
// Builds using the actual Vite production configuration without reading credentials.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { build } from "vite";

const root=fileURLToPath(new URL("..",import.meta.url));
const normal=id=>id.replaceAll("\\","/").replace(root.replaceAll("\\","/")+"/","");
const blocked=/(?:^|\/)(?:@firebase\/firestore(?:-compat)?|@grpc\/grpc-js)(?:\/|$)/;
let evidence;
await build({root,plugins:[{
  name:"audit-firebase-reachability",
  generateBundle(_options,bundle) {
    const graph=[...this.getModuleIds()].map(normal).sort();
    const chunks=Object.values(bundle).filter(item=>item.type==="chunk");
    const emitted=[...new Set(chunks.flatMap(chunk=>Object.keys(chunk.modules).map(normal)))].sort();
    const loadedFindings=graph.filter(id=>blocked.test(id));
    const emittedFindings=emitted.filter(id=>blocked.test(id));
    evidence={
      scope:"Actual Vite production module graph and emitted chunks; installed dependencies remain separately audited",
      graphModules:graph.length, emittedModules:emitted.length,
      loadedFirestoreOrGrpc:loadedFindings, emittedFirestoreOrGrpc:emittedFindings,
      emittedFirebaseModules:emitted.filter(id=>id.includes("/firebase/")||id.includes("/@firebase/")),
      chunks:chunks.map(chunk=>({file:chunk.fileName,imports:chunk.imports,dynamicImports:chunk.dynamicImports})),
    };
    assert.deepEqual(loadedFindings,[],"Firestore/gRPC entered the loaded production graph: review exposure before release.");
    assert.deepEqual(emittedFindings,[],"Firestore/gRPC entered emitted production chunks.");
    assert(emitted.some(id=>id.includes("/@firebase/messaging/")),"Messaging must remain in the build.");
    assert(emitted.some(id=>id.includes("/@firebase/app/")),"Firebase app must remain in the build.");
  },
}]});
assert(evidence);
const output=resolve(root,"artifacts/dependency-security");
await mkdir(output,{recursive:true});
await writeFile(resolve(output,"bundle-reachability.json"),JSON.stringify(evidence,null,2));
console.log(`PASS: Firestore/gRPC absent from ${evidence.graphModules} loaded and ${evidence.emittedModules} emitted modules; Firebase app/messaging retained.`);
