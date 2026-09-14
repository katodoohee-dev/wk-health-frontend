import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Flame, Heart, Share2, UserPlus, Copy, Loader2, Check, Pencil, X, MapPin, MapPinOff } from "lucide-react";
import { PageHeader, GlassCard } from "@/components/app/ui-bits";
import { ErrorState, Skeleton } from "@/components/app/states";
import { useAuth } from "@/lib/auth";
import { apiFriendsList, apiFriendsCheer, apiFriendsInviteCode, apiFriendsAdd, apiStatsWeekSummary, apiFriendLocationSharingStatus, apiFriendLocationShare } from "@/lib/api-new-features";
import { renderWeekShareImage, shareOrDownloadImage } from "@/lib/share-image";
import { getFriendNickname, setFriendNickname } from "@/lib/friend-nicknames";

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "เพื่อนและ Streak — WK Health App" },
      { name: "description", content: "ดู streak ของเพื่อน ให้กำลังใจกัน และแชร์สรุปสัปดาห์ของคุณ" },
    ],
  }),
  component: FriendsPage,
});

function FriendsPage() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  // FIX: เพิ่มใหม่ — ตั้งชื่อเล่นเพื่อน (local-only ดู friend-nicknames.ts) + ดูโปรไฟล์เพื่อน
  const [nicknameVersion, setNicknameVersion] = useState(0); // บังคับ re-render หลังแก้ nickname
  const [editingFriend, setEditingFriend] = useState<{ id: string; name: string } | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [viewingFriend, setViewingFriend] = useState<{ id: string; name: string; avatar?: string; streak: number } | null>(null);

  const friends = useQuery({ queryKey: ["friends", "list"], queryFn: apiFriendsList, enabled: isAuthenticated });
  const invite = useQuery({ queryKey: ["friends", "invite"], queryFn: apiFriendsInviteCode, enabled: isAuthenticated });
  const week = useQuery({ queryKey: ["stats", "week-summary"], queryFn: apiStatsWeekSummary, enabled: isAuthenticated });

  // FIX: เพิ่มใหม่ — สถานะเปิด/ปิดแชร์ตำแหน่งของตัวเองให้เพื่อนเห็น (ใช้ endpoint ที่มีอยู่แล้ว
  // ใน api-new-features.ts ซึ่งเดิมมี backend รองรับแล้วแต่ไม่มี UI ให้กดเปิด/ปิดเลย)
  const locationSharing = useQuery({
    queryKey: ["friends", "location-sharing"],
    queryFn: apiFriendLocationSharingStatus,
    enabled: isAuthenticated,
  });
  const toggleLocationSharing = useMutation({
    mutationFn: (enabled: boolean) => apiFriendLocationShare(enabled),
    onSuccess: (status) => qc.setQueryData(["friends", "location-sharing"], status),
  });

  const cheer = useMutation({
    mutationFn: apiFriendsCheer,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["friends", "list"] }),
  });

  const addFriend = useMutation({
    mutationFn: () => apiFriendsAdd(code),
    onSuccess: () => {
      setCode("");
      void qc.invalidateQueries({ queryKey: ["friends", "list"] });
    },
  });

  const sorted = [...(friends.data ?? [])].sort((a, b) => b.streak - a.streak);

  const [shareResult, setShareResult] = useState<"shared" | "downloaded" | null>(null);
  const share = useMutation({
    mutationFn: async () => {
      const blob = await renderWeekShareImage({
        streak: week.data?.streak ?? 0,
        avgKcal: week.data?.avgKcal ?? 0,
        daysOnGoal: week.data?.daysOnGoal ?? 0,
      });
      return shareOrDownloadImage(blob, `wk-health-week-summary-${new Date().toISOString().slice(0, 10)}.png`);
    },
    onSuccess: (result) => {
      if (result !== "cancelled") {
        setShareResult(result);
        setTimeout(() => setShareResult(null), 3000);
      }
    },
  });

  return (
    <div className="rise-in">
      <PageHeader title="เพื่อนและ Streak" subtitle="ให้กำลังใจกัน ไม่ต้องแข่งตัวเลขแคล" />

      {/* weekly share card */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between">
          <p className="font-display font-semibold">สรุปสัปดาห์ของคุณ</p>
          <button
            onClick={() => share.mutate()}
            disabled={share.isPending || week.isLoading}
            className="press glass grid size-9 place-items-center rounded-xl disabled:opacity-50"
            aria-label="แชร์เป็นรูป"
          >
            {share.isPending ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
          </button>
        </div>
        {shareResult && (
          <p className="mt-2 flex items-center gap-1 text-xs text-mint">
            <Check className="size-3.5" />
            {shareResult === "shared" ? "แชร์รูปสำเร็จ" : "บันทึกรูปลงเครื่องแล้ว"}
          </p>
        )}
        {share.isError && (
          <p className="mt-2 text-xs text-destructive">สร้างรูปไม่สำเร็จ ลองใหม่อีกครั้ง</p>
        )}
        {week.isLoading ? (
          <Skeleton className="mt-3 h-20 w-full rounded-2xl" />
        ) : week.isError ? (
          <ErrorState error={week.error} onRetry={() => void week.refetch()} />
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-muted/60 px-2 py-3">
              <p className="font-display text-lg font-bold tabular-nums">{week.data?.streak ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">วัน streak</p>
            </div>
            <div className="rounded-2xl bg-muted/60 px-2 py-3">
              <p className="font-display text-lg font-bold tabular-nums">{week.data?.avgKcal ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">kcal เฉลี่ย</p>
            </div>
            <div className="rounded-2xl bg-muted/60 px-2 py-3">
              <p className="font-display text-lg font-bold tabular-nums">{week.data?.daysOnGoal ?? 0}/7</p>
              <p className="text-[10px] text-muted-foreground">วันตามเป้า</p>
            </div>
          </div>
        )}
      </GlassCard>

      {/* location sharing toggle */}
      <GlassCard className="mt-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${locationSharing.data?.enabled ? "bg-mint-soft text-mint" : "bg-muted text-muted-foreground"}`}>
              {locationSharing.data?.enabled ? <MapPin className="size-5" /> : <MapPinOff className="size-5" />}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">แชร์ตำแหน่งให้เพื่อน</p>
              <p className="truncate text-xs text-muted-foreground">
                {locationSharing.isLoading ? "กำลังโหลด..." : locationSharing.data?.enabled ? "เพื่อนที่ยืนยันแล้วเห็นตำแหน่งคุณตอนวิ่ง/เดินอยู่" : "ปิดอยู่ — เพื่อนมองไม่เห็นตำแหน่งคุณ"}
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleLocationSharing.mutate(!(locationSharing.data?.enabled ?? false))}
            disabled={locationSharing.isLoading || toggleLocationSharing.isPending}
            aria-pressed={locationSharing.data?.enabled ?? false}
            aria-label="เปิด/ปิดแชร์ตำแหน่งให้เพื่อน"
            className={`press relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${locationSharing.data?.enabled ? "bg-mint" : "bg-muted"}`}
          >
            <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-transform ${locationSharing.data?.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>
        {toggleLocationSharing.isError && (
          <p className="mt-2 text-xs text-destructive">เปลี่ยนสถานะแชร์ตำแหน่งไม่สำเร็จ ลองใหม่อีกครั้ง</p>
        )}
      </GlassCard>

      {/* add friend */}
      <GlassCard className="mt-4 p-5">
        <p className="mb-3 flex items-center gap-2 font-display font-semibold"><UserPlus className="size-4" /> เพิ่มเพื่อน</p>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="กรอกโค้ดเชิญ"
            className="glass min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
          />
          <button
            onClick={() => code && addFriend.mutate()}
            disabled={!code || addFriend.isPending}
            className="press bg-mint-gradient shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-50"
          >
            เพิ่ม
          </button>
        </div>
        {invite.data?.code && (
          <button
            onClick={() => void navigator.clipboard.writeText(invite.data!.code)}
            className="press glass mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs text-muted-foreground"
          >
            <Copy className="size-3.5" /> โค้ดเชิญของคุณ: <span className="font-semibold text-foreground">{invite.data.code}</span>
          </button>
        )}
      </GlassCard>

      {/* leaderboard */}
      <section className="mt-6">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Users className="size-4" /> Streak เพื่อน
        </p>
        {friends.isLoading ? (
          <div className="space-y-2"><Skeleton className="h-16 w-full rounded-2xl" /><Skeleton className="h-16 w-full rounded-2xl" /></div>
        ) : friends.isError ? (
          <ErrorState error={friends.error} onRetry={() => void friends.refetch()} />
        ) : sorted.length === 0 ? (
          <p className="glass-strong rounded-3xl p-6 text-center text-sm text-muted-foreground">
            ยังไม่มีเพื่อนในระบบ — แชร์โค้ดเชิญให้เพื่อนเริ่มเช็คอินไปด้วยกัน
          </p>
        ) : (
          <div className="space-y-2">
            {sorted.map((f, i) => (
              <div key={f.id} className="glass-strong flex items-center gap-3 rounded-2xl p-3 shadow-soft">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground">#{i + 1}</span>
                <button
                  onClick={() => setViewingFriend(f)}
                  className="press flex min-w-0 flex-1 items-center gap-3 text-left"
                  aria-label={`ดูโปรไฟล์ ${f.name}`}
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-mint-soft text-lg">{f.avatar ?? "🙂"}</span>
                  <div className="min-w-0 flex-1">
                    {/* FIX: เพิ่มใหม่ — ถ้าตั้งชื่อเล่นไว้ โชว์ชื่อเล่นเป็นหลัก (ชื่อจริงเป็นตัวเล็กข้างล่าง) */}
                    <p className="truncate font-medium">{getFriendNickname(f.id) || f.name}</p>
                    {getFriendNickname(f.id) && <p className="truncate text-[10px] text-muted-foreground">{f.name}</p>}
                    <p className="flex items-center gap-1 text-xs text-muted-foreground"><Flame className="size-3" />{f.streak} วันติด</p>
                  </div>
                </button>
                <button
                  onClick={() => { setEditingFriend({ id: f.id, name: f.name }); setNicknameDraft(getFriendNickname(f.id)); }}
                  className="press glass grid size-8 shrink-0 place-items-center rounded-xl text-muted-foreground"
                  aria-label={`ตั้งชื่อเล่นให้ ${f.name}`}
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  onClick={() => cheer.mutate(f.id)}
                  disabled={cheer.isPending}
                  className="press glass flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium text-peach"
                >
                  <Heart className="size-3.5" /> เชียร์
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* FIX: เพิ่มใหม่ — modal ตั้งชื่อเล่นเพื่อน */}
      {editingFriend && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => setEditingFriend(null)}>
          <div className="glass-strong w-full max-w-sm rounded-3xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display font-semibold">ตั้งชื่อเล่นให้ {editingFriend.name}</p>
              <button onClick={() => setEditingFriend(null)} className="press glass grid size-8 place-items-center rounded-xl" aria-label="ปิด"><X className="size-4" /></button>
            </div>
            <input
              autoFocus
              value={nicknameDraft}
              onChange={(e) => setNicknameDraft(e.target.value)}
              placeholder={editingFriend.name}
              maxLength={30}
              className="glass w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => { setFriendNickname(editingFriend.id, ""); setNicknameDraft(""); setNicknameVersion((v) => v + 1); setEditingFriend(null); }}
                className="press glass flex-1 rounded-xl py-2.5 text-sm text-muted-foreground"
              >
                ใช้ชื่อจริง
              </button>
              <button
                onClick={() => { setFriendNickname(editingFriend.id, nicknameDraft); setNicknameVersion((v) => v + 1); setEditingFriend(null); }}
                className="press bg-mint-gradient flex-1 rounded-xl py-2.5 text-sm font-medium text-primary-foreground shadow-glow"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FIX: เพิ่มใหม่ — modal ดูโปรไฟล์เพื่อน (แตะที่แถวเพื่อนในลิสต์) */}
      {viewingFriend && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => setViewingFriend(null)}>
          <div className="glass-strong w-full max-w-sm rounded-3xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setViewingFriend(null)} className="press glass ml-auto grid size-8 place-items-center rounded-xl" aria-label="ปิด"><X className="size-4" /></button>
            <span className="mx-auto grid size-20 place-items-center rounded-3xl bg-mint-soft text-4xl">{viewingFriend.avatar ?? "🙂"}</span>
            <p className="mt-3 font-display text-xl font-bold">{getFriendNickname(viewingFriend.id) || viewingFriend.name}</p>
            {getFriendNickname(viewingFriend.id) && <p className="text-xs text-muted-foreground">ชื่อจริง: {viewingFriend.name}</p>}
            <div className="mt-4 rounded-2xl bg-muted/60 px-4 py-3">
              <p className="font-display text-2xl font-bold tabular-nums">{viewingFriend.streak}</p>
              <p className="text-xs text-muted-foreground">วัน streak ติดต่อกัน</p>
            </div>
            <button
              onClick={() => { setEditingFriend({ id: viewingFriend.id, name: viewingFriend.name }); setNicknameDraft(getFriendNickname(viewingFriend.id)); setViewingFriend(null); }}
              className="press glass mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium"
            >
              <Pencil className="size-3.5" /> ตั้งชื่อเล่น
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
