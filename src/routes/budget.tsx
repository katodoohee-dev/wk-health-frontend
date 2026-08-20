import { createFileRoute } from "@tanstack/react-router";
import { ScanBarcode } from "lucide-react";
import { AppShell } from "@/components/wk/shell";
export const Route=createFileRoute("/budget")({component:BarcodePage});
function BarcodePage(){return <AppShell title="Barcode"><section className="mx-auto max-w-3xl"><p className="label-xs">Food intelligence</p><h1 className="display mt-2 text-4xl">Barcode</h1><div className="mt-8 grid min-h-80 place-items-center rounded-xl border border-border bg-card p-8 text-center"><div><ScanBarcode className="mx-auto size-10"/><p className="mt-4 text-lg font-medium">Scan a product barcode</p><p className="mt-2 text-sm text-muted-foreground">Product and nutrition details will appear here.</p></div></div></section></AppShell>}
