import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = (message) => {
  console.error(`PRODUCTION CHECK FAILED: ${message}`);
  process.exit(1);
};

const api = read("src/lib/api.ts");
const features = read("src/lib/api-new-features.ts");
const auth = read("src/lib/auth-api.ts");
const routes = read("src/routeTree.gen.ts");

if (/localhost|127\.0\.0\.1/.test(api)) fail("frontend API client contains localhost/loopback");
if (/apigemini\.katodoohee\.workers\.dev/.test(api)) fail("frontend must not hard-code Gemini proxy");
if (!/VITE_API_BASE_URL/.test(api) || !/VITE_API_URL/.test(api) || !/VITE_BACKEND_URL/.test(api)) fail("API environment aliases are incomplete");
if (!/\/api\/insight\/weekly/.test(features)) fail("weekly insight must use the backend endpoint");
if (!/\/api\/auth\/(login|register|me)/.test(auth)) fail("auth API contract missing");
for (const required of ["/auth", "/insight", "/settings", "/diary", "/scan"]) {
  if (!routes.includes(required)) fail(`required route missing from generated route tree: ${required}`);
}

const envExamplePath = path.join(root, ".env.example");
if (fs.existsSync(envExamplePath)) {
  const env = fs.readFileSync(envExamplePath, "utf8");
  if (!/VITE_API_BASE_URL/.test(env)) fail(".env.example missing VITE_API_BASE_URL");
}

console.log("Production contract checks passed");
