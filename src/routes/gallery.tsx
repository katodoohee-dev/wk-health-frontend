import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Image as ImageIcon } from "lucide-react";
import { PageHeader, GlassCard } from "@/components/app/ui-bits";
import { ErrorState, LoadingState } from "@/components/app/states";
import { useAuth } from "@/lib/auth";
import { API_BASE_URL, apiGallery } from "@/lib/api";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "แกลเลอรีรูปอาหาร — WK Health App" },
      { name: "description", content: "ย้อนดูรูปอาหารที่เคยสแกนไว้ทั้งหมดเรียงตามเวลา" },
      { property: "og:title", content: "แกลเลอรีรูปอาหาร — WK Health App" },
      { property: "og:description", content: "ไทม์ไลน์รูปอาหารที่คุณเคยสแกน" },
    ],
  }),
  component: GalleryPage,
});

function resolvePhotoUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  return `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`;
}

function GalleryPage() {
  const { isAuthenticated } = useAuth();
  const gallery = useQuery({ queryKey: ["gallery"], queryFn: apiGallery, enabled: isAuthenticated });

  return (
    <div className="rise-in">
      <PageHeader title="แกลเลอรี" emoji="🖼️" subtitle="ย้อนดูรูปอาหารที่เคยสแกน" />

      {gallery.isLoading ? (
        <LoadingState label="กำลังโหลดแกลเลอรี…" />
      ) : gallery.isError ? (
        <ErrorState error={gallery.error} onRetry={() => void gallery.refetch()} />
      ) : (gallery.data ?? []).length === 0 ? (
        <GlassCard className="grid place-items-center gap-2 p-10 text-center">
          <span className="grid size-14 place-items-center rounded-3xl bg-muted text-muted-foreground">
            <ImageIcon className="size-6" />
          </span>
          <p className="text-sm text-muted-foreground">ยังไม่มีรูปอาหารที่บันทึกไว้ — ลองสแกนอาหารดูสิ 📸</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {gallery.data!.map((item) => (
            <div key={item.id} className="group overflow-hidden rounded-3xl shadow-soft">
              <div className="relative aspect-square w-full overflow-hidden bg-muted">
                <img
                  src={resolvePhotoUrl(item.photoUrl)}
                  alt={item.foodName}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2.5 pt-6">
                  <p className="truncate text-xs font-medium text-white">{item.foodName}</p>
                  <p className="text-[10px] text-white/80">{item.calories} kcal · {item.date}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
