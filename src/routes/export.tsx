import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, FileText, FileSpreadsheet, ShieldCheck, Clock } from "lucide-react";
import { PageHeader, GlassCard } from "@/components/app/ui-bits";
import { ErrorState, Skeleton } from "@/components/app/states";
import { useAuth } from "@/lib/auth";
import { apiExportRequest, apiExportHistory } from "@/lib/api-new-features";

export const Route = createFileRoute("/export")({
  head: () => ({
    meta: [
      { title: "ส่งออกข้อมูล — WK Health App" },
      { name: "description", content: "ส่งออกข้อมูลสุขภาพของคุณเป็น PDF หรือ CSV และตั้งค่าสำรองข้อมูลอัตโนมัติ" },
    ],
  }),
  component: ExportPage,
});

const FORMATS = [
  { key: "pdf" as const, label: "PDF", desc: "รายงานสรุปอ่านง่าย เหมาะแชร์ให้แพทย์", icon: FileText, tint: "bg-peach-soft text-peach" },
  { key: "csv" as const, label: "CSV", desc: "ข้อมูลดิบ เปิดใน Excel/Sheets ได้", icon: FileSpreadsheet, tint: "bg-sky-soft text-sky" },
];

function ExportPage() {
  const { isAuthenticated } = useAuth();
  const [format, setFormat] = useState<"pdf" | "csv">("pdf");
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "all">("30d");

  const history = useQuery({
    queryKey: ["export", "history"],
    queryFn: apiExportHistory,
    enabled: isAuthenticated,
  });

  const doExport = useMutation({
    mutationFn: () => apiExportRequest({ format, range }),
    onSuccess: (res) => {
      if (res.downloadUrl) window.open(res.downloadUrl, "_blank");
    },
  });

  return (
    <div className="rise-in">
      <PageHeader title="ส่งออกข้อมูล" subtitle="ดาวน์โหลดหรือสำรองข้อมูลสุขภาพของคุณเอง" />

      <GlassCard className="p-5">
        <p className="mb-3 text-sm font-semibold">รูปแบบไฟล์</p>
        <div className="grid grid-cols-2 gap-3">
          {FORMATS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFormat(f.key)}
              className={`press rounded-2xl p-4 text-left shadow-soft ${format === f.key ? "glass-strong ring-2 ring-primary" : "glass"}`}
            >
              <span className={`grid size-10 place-items-center rounded-2xl ${f.tint}`}><f.icon className="size-5" /></span>
              <p className="mt-2 font-display font-semibold">{f.label}</p>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </button>
          ))}
        </div>

        <p className="mb-3 mt-5 text-sm font-semibold">ช่วงเวลา</p>
        <div className="flex flex-wrap gap-2">
          {([
            { key: "7d", label: "7 วันล่าสุด" },
            { key: "30d", label: "30 วันล่าสุด" },
            { key: "90d", label: "90 วันล่าสุด" },
            { key: "all", label: "ทั้งหมด" },
          ] as const).map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`press rounded-full px-4 py-2 text-xs font-medium ${range === r.key ? "bg-mint-gradient text-primary-foreground shadow-glow" : "glass"}`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => doExport.mutate()}
          disabled={doExport.isPending}
          className="press bg-mint-gradient mt-5 flex w-full items-center justify-center gap-2 rounded-2xl p-4 font-display font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
        >
          <Download className="size-5" />
          {doExport.isPending ? "กำลังเตรียมไฟล์…" : `ดาวน์โหลด ${format.toUpperCase()}`}
        </button>
        {doExport.isError && (
          <p className="mt-2 text-center text-xs text-destructive">ส่งออกไม่สำเร็จ ลองใหม่อีกครั้ง</p>
        )}

        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" /> ข้อมูลเข้ารหัสระหว่างส่งออก เฉพาะคุณเข้าถึงได้
        </p>
      </GlassCard>

      <section className="mt-6">
        <p className="mb-2 text-sm font-semibold text-muted-foreground">ประวัติการส่งออก</p>
        {history.isLoading ? (
          <div className="space-y-2"><Skeleton className="h-14 w-full rounded-2xl" /><Skeleton className="h-14 w-full rounded-2xl" /></div>
        ) : history.isError ? (
          <ErrorState error={history.error} onRetry={() => void history.refetch()} />
        ) : !history.data?.length ? (
          <p className="glass-strong rounded-3xl p-6 text-center text-sm text-muted-foreground">ยังไม่เคยส่งออกข้อมูล</p>
        ) : (
          <div className="space-y-2">
            {history.data.map((h) => (
              <div key={h.id} className="glass-strong flex items-center gap-3 rounded-2xl p-3 shadow-soft">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-muted"><Clock className="size-4 text-muted-foreground" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{h.format.toUpperCase()} · {h.range}</p>
                  <p className="truncate text-xs text-muted-foreground">{h.createdAt}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
