import { Link, createFileRoute } from "@tanstack/react-router";
import { Compass, MapPinned, Navigation, Route as RouteIcon } from "lucide-react";
import { AppShell } from "@/components/wk/shell";
import { Action, Metric, Panel, PageHeader } from "@/components/wk/ui";

export const Route = createFileRoute("/navigate")({
  head: () => ({ meta: [{ title: "Navigate — WK Health" }] }),
  component: NavigatePage,
});

function NavigatePage() {
  return (
    <AppShell title="Navigate">
      <PageHeader
        eyebrow="Movement / Guidance"
        title="Move with context."
        description="แผนที่และเส้นทางจะทำงานร่วมกับระบบ GPS เมื่อได้รับสิทธิ์ตำแหน่ง"
        actions={<Link to="/pedometer"><Action icon={Navigation} variant="solid">เปิด GPS</Action></Link>}
      />
      <div className="grid gap-6 py-8 lg:grid-cols-[1.4fr_.6fr]">
        <Panel tone="ink" className="min-h-[360px] border-transparent">
          <div className="flex h-full min-h-[310px] flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3"><span className="grid size-9 place-items-center border border-white/20"><MapPinned className="size-4" /></span><span className="label-xs">LIVE ROUTE</span></div>
              <span className="num text-[10px] opacity-60">GPS / READY</span>
            </div>
            <div>
              <p className="display max-w-xl text-4xl">Ready for your next route.</p>
              <p className="mt-3 max-w-xl text-sm leading-6 opacity-65">เปิด GPS จากหน้า Activity เพื่อเริ่มบันทึกตำแหน่ง ระยะทาง และเส้นทางแบบเรียลไทม์</p>
            </div>
          </div>
        </Panel>
        <aside className="space-y-6">
          <Panel title="Route signal"><Metric label="Status" value="READY" size="lg" /><div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><RouteIcon className="size-3.5" />Location permission required</div></Panel>
          <Panel title="Quick start"><Link to="/pedometer"><Action icon={Compass} variant="outline" className="w-full">เริ่มการติดตาม</Action></Link></Panel>
        </aside>
      </div>
    </AppShell>
  );
}
