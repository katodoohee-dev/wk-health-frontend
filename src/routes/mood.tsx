import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { AppShell } from "@/components/wk/shell";
export const Route=createFileRoute("/mood")({component:DiaryStatsPage});
function DiaryStatsPage(){const rows=[["Entries","18","this month"],["Meals logged","42","across 18 days"],["Average energy","1,860","kcal / day"],["Consistency","86%","logging streak"]];return <AppShell title="Diary stats"><section className="mx-auto max-w-5xl"><p className="label-xs">Diary analytics</p><h1 className="display mt-2 text-4xl">Patterns in your diary.</h1><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{rows.map(([a,b,c])=><div key={a} className="border border-border bg-card p-6"><BarChart3 className="size-4 text-muted-foreground"/><p className="label-xs mt-7">{a}</p><p className="num mt-2 text-2xl">{b}</p><p className="text-xs text-muted-foreground">{c}</p></div>)}</div></section></AppShell>}
