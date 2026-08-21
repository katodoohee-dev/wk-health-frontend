import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const fail=message=>{console.error(`PRODUCTION CHECK FAILED: ${message}`);process.exit(1)};
const routePath=route=>path.join(root,"src","routes",`${route.replace(/^\//,"")}.tsx`);
const api=read("src/lib/api.ts");const live=read("src/lib/live-api.ts");const features=read("src/lib/api-new-features.ts");const auth=read("src/lib/auth-api.ts");const shell=read("src/components/wk/shell.tsx");const contracts=read("src/lib/page-contract.ts");
const routeFiles=["home","auth","budget","device-connect","diary","export","friends","gallery","mood","music","nlp","notifications","pedometer","profile","scan","sound-control","stats","vision","workout","assistant"];
if(/localhost|127\.0\.0\.1/.test(api))fail("frontend API client contains localhost/loopback");
if(/apigemini\.katodoohee\.workers\.dev/.test(api))fail("frontend must not hard-code Gemini proxy");
if(!/VITE_API_BASE_URL/.test(api)||!/VITE_API_URL/.test(api)||!/VITE_BACKEND_URL/.test(api))fail("API environment aliases are incomplete");
if(!/\/api\/export/.test(features))fail("export must use backend endpoint");
if(!/\/api\/auth\/(login|register|me)/.test(auth))fail("auth API contract missing");
if(!/\/api\/devices/.test(live)||!/\/api\/sound/.test(live))fail("live device/sound API contract missing");
if(!/PAGE_CONTRACTS/.test(contracts)||!/Health Overview/.test(contracts)||!/Food Scan/.test(contracts))fail("page contracts missing backend-aligned titles");
for(const route of routeFiles){const file=routePath(`/${route}`);if(!fs.existsSync(file))fail(`required route source missing: /${route}`);const source=fs.readFileSync(file,"utf8");if(!source.includes(`createFileRoute(\"/${route}\")`)&&!source.includes(`createFileRoute('/${route}')`))fail(`route source is not a TanStack file route: /${route}`)}
const linkedRoutes=[...shell.matchAll(/to:\s*[\"'](\/[^\"']*)[\"']/g)].map(m=>m[1]);for(const route of [...new Set(linkedRoutes)])if(!fs.existsSync(routePath(route)))fail(`navigation points to missing route source: ${route}`);
const envExamplePath=path.join(root,".env.example");if(fs.existsSync(envExamplePath)&&!/VITE_API_BASE_URL/.test(read(".env.example")))fail(".env.example missing VITE_API_BASE_URL");
console.log(`Production contract checks passed (${routeFiles.length} supplied screens; ${new Set(linkedRoutes).size} navigation targets validated; real backend API contracts enabled)`);
