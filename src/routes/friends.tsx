import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Flame, Heart, Share2, UserPlus, Copy } from "lucide-react";
import { PageHeader, GlassCard } from "@/components/app/ui-bits";
import { ErrorState, Skeleton } from "@/components/app/states";
import { useAuth } from "@/lib/auth";
import { apiFriendsList, apiFriendsCheer, apiFriendsInviteCode, apiFriendsAdd, apiStatsWeekSummary } from "@/lib/api-new-features";

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

  const friends = useQuery({ queryKey: ["friends", "list"], queryFn: apiFriendsList, enabled: isAuthenticated });
  const invite = useQuery({ queryKey: ["friends", "invite"], queryFn: apiFriendsInviteCode, enabled: isAuthenticated });
  const week = useQuery({ queryKey: ["stats", "week-summary"], queryFn: apiStatsWeekSummary, enabled: isAuthenticated });

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

  return (
    <div className="rise-in">
      <PageHeader title="เพื่อนและ Streak" subtitle="ให้กำลังใจกัน ไม่ต้องแข่งตัวเลขแคล" />

      {/* weekly share card */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between">
          <p className="font-display font-semibold">สรุปสัปดาห์ของคุณ</p>
          <button className="press glass grid size-9 place-items-center rounded-xl" aria-label="แชร์เป็นรูป">
            <Share2 className="size-4" />
          </button>
        </div>
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
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-mint-soft text-lg">{f.avatar ?? "🙂"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{f.name}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground"><Flame className="size-3" />{f.streak} วันติด</p>
                </div>
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
    </div>
  );
}
