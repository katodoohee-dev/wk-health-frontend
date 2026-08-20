import { createFileRoute } from "@tanstack/react-router";
import { HeartPulse } from "lucide-react";
import { AppShell } from "@/components/wk/shell";
export const Route=createFileRoute("/device-connect")({component:BodyPage});
function BodyPage(){return <AppShell title="Body"><section className="mx-auto max-w-4xl"><p className="label-xs">Body signals</p><h1 className="display mt-2 text-4xl">Body</h1><div className="mt-8 grid gap-4 sm:grid-cols-3">{[["Weight","—","kg"],["Resting heart rate","—","bpm"],["Body trend","Stable","30 days"]].map(([a,b,c])=><div key={a} className="border border-border bg-card p-6"><HeartPulse className="size-4 text-muted-foreground"/><p className="label-xs mt-7">{a}</p><p className="num mt-2 text-2xl">{b}</p><p className="text-xs text-muted-foreground">{c}</p></div>)}</div></section></AppShell>}
