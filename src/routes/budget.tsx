import { createFileRoute } from "@tanstack/react-router";
import { ScanBarcode } from "lucide-react";
import { AppShell } from "@/components/wk/shell";
export const Route=createFileRoute("/budget")({component:BarcodePage});
function BarcodePage(){return <AppShell title="Barcode"><Page title="Barcode" eyebrow="Food intelligence" icon={<ScanBarcode/>} text="Scan a product barcode to identify nutrition and product data."/></AppShell>}
function Page({title,eyebrow,icon,text}:{title:string;eyebrow:string;icon:React.ReactNode;text:string}){return <section className="mx-auto max-w-3xl"><p className="label-xs">{eyebrow}</p><h1 className="display mt-2 text-4xl">{title}</h1><div className="mt-8 grid min-h-80 place-items-center rounded-xl border border-border bg-card p-8 text-center"><div>{icon}<p className="mt-4 text-lg font-medium">{text}</p><p className="mt-2 text-sm text-muted-foreground">Connected to the WK Health product layer.</p></div></div></section>}
