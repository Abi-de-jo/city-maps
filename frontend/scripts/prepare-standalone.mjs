import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();
const standaloneRoot = join(projectRoot, ".next", "standalone");
const staticSource = join(projectRoot, ".next", "static");
const staticTarget = join(standaloneRoot, ".next", "static");
const publicSource = join(projectRoot, "public");
const publicTarget = join(standaloneRoot, "public");

if (!existsSync(join(standaloneRoot, "server.js"))) {
  throw new Error("Next.js standalone server was not generated.");
}

mkdirSync(staticTarget, { recursive: true });
cpSync(staticSource, staticTarget, { recursive: true, force: true });

if (existsSync(publicSource)) {
  mkdirSync(publicTarget, { recursive: true });
  cpSync(publicSource, publicTarget, { recursive: true, force: true });
}

console.log("Prepared standalone server with matching static and public assets.");
