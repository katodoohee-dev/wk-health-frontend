import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = (message) => {
  console.error(`PRODUCTION CHECK FAILED: ${message}`);
  process.exit(1);
};
const routePath = (route) => path.join(root, "src", "routes", `${route.replace(/^\//, "")}.tsx`);

const api = read("src/lib/api.ts");
const features = read("src/lib/api-new-features.ts");
const auth = read("src/lib/auth-api.ts");
const shell = read("src/components/wk/shell.tsx");
const routeFiles = ["auth", "insight", "settings", "diary", "scan", "barcode", "navigate"];

if (/localhost|127\.0\.0\.1/.test(api)) fail("frontend API client contains localhost/loopback");
if (/apigemini\.katodoohee\.workers\.dev/.test(api)) fail("frontend must not hard-code Gemini proxy");
if (!/VITE_API_BASE_URL/.test(api) || !/VITE_API_URL/.test(api) || !/VITE_BACKEND_URL/.test(api)) fail("API environment aliases are incomplete");
if (!/\/api\/insight\/weekly/.test(features)) fail("weekly insight must use the backend endpoint");
if (!/\/api\/auth\/(login|register|me)/.test(auth)) fail("auth API contract missing");

for (const route of routeFiles) {
  const routeFile = routePath(`/${route}`);
  if (!fs.existsSync(routeFile)) fail(`required route source missing: /${route}`);
  const source = fs.readFileSync(routeFile, "utf8");
  if (!source.includes(`createFileRoute("/${route}")`)) fail(`route source is not a TanStack file route: /${route}`);
}

const linkedRoutes = [...shell.matchAll(/to:\s*"(\/[^"?#]*)"/g)].map((m) => m[1]);
const uniqueLinkedRoutes = [...new Set(linkedRoutes)];
for (const route of uniqueLinkedRoutes) {
  const file = routePath(route);
  if (route !== "/" && !fs.existsSync(file)) fail(`navigation points to missing route source: ${route}`);
}

const envExamplePath = path.join(root, ".env.example");
if (fs.existsSync(envExamplePath)) {
  const env = fs.readFileSync(envExamplePath, "utf8");
  if (!/VITE_API_BASE_URL/.test(env)) fail(".env.example missing VITE_API_BASE_URL");
}

console.log(`Production contract checks passed (${uniqueLinkedRoutes.length} navigation targets validated)`);
