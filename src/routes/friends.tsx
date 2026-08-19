import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Flame, Heart, Share2, UserPlus, Copy, MapPin, Radio, ShieldCheck, Square } from "lucide-react";
import { PageHeader, GlassCard } from "@/components/app/ui-bits";
import { ErrorState, Skeleton } from "@/components/app/states";
import { useAuth } from "@/lib/auth";
import {
  apiFriendsList,
  apiFriendsCheer,
  apiFriendsInviteCode,
  apiFriendsAdd,
  apiStatsWeekSummary,
  apiFriendLocations,
  type FriendLocation,
} from "@/lib/api-new-features";
import { featureFlags } from "@/lib/feature-flags";
import {
  getFriendLocationSharingState,
  hydrateFriendLocationSharingStatus,
  startFriendLocationSharing,
  stopFriendLocationSharing,
} from "@/lib/friend-location";

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "เพื่อนและ Streak — WK Health App" },
      { name: "description", content: "ดู streak ของเพื่อน ให้กำลังใจกัน แชร์ตำแหน่งกับเพื่อนที่ยืนยันแล้ว และดูตำแหน่งสด" },
    ],
  }),
  component: FriendsPage,
});

function FriendsPage() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationWatching, setLocationWatching] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);

  const friends = useQuery({ queryKey: ["friends", "list"], queryFn: apiFriendsList, enabled: isAuthenticated });
  const invite = useQuery({ queryKey: ["friends", "invite"], queryFn: apiFriendsInviteCode, enabled: isAuthenticated });
  const week = useQuery({ queryKey: ["stats", "week-summary"], queryFn: apiStatsWeekSummary, enabled: isAuthenticated });
  const liveLocations = useQuery<FriendLocation[]>({
    queryKey: ["friends", "locations", "live"],
    queryFn: apiFriendLocations,
    enabled: isAuthenticated && featureFlags.locationSharing,
    refetchInterval: featureFlags.locationSharing ? 5000 : false,
    refetchIntervalInBackground: false,
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

  const liveByFriend = useMemo(() => new Map((liveLocations.data ?? []).map((item) => [item.friendId, item])), [liveLocations.data]);
  const sorted = [...(friends.data ?? [])].sort((a, b) => b.streak - a.streak);

  useEffect(() => {
    if (!isAuthenticated || !featureFlags.locationSharing) return;
    void hydrateFriendLocationSharingStatus().then((remote) => {
      const next = remote ? Boolean(remote.enabled && remote.visibleToConfirmedFriends) : getFriendLocationSharingState().enabled;
      const s = getFriendLocationSharingState();
      setLocationEnabled(next);
      setLocationWatching(s.watching);
      setLocationError(s.lastError);
    });

    const onState = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean; watching?: boolean; lastError?: string | null }>).detail;
      setLocationEnabled(Boolean(detail?.enabled));
      setLocationWatching(Boolean(detail?.watching));
      setLocationError(detail?.lastError ?? null);
    };
    const onShowLocation = (event: Event) => {
      const friendId = (event as CustomEvent<{ friendId?: string }>).detail?.friendId;
      if (friendId) setSelectedFriendId(friendId);
    };
    window.addEventListener("wk:friend-location-state", onState);
    window.addEventListener("wk:friends-show-location", onShowLocation);
    return () => {
      window.removeEventListener("wk:friend-location-state", onState);
      window.removeEventListener("wk:friends-show-location", onShowLocation);
    };
  }, [isAuthenticated]);

  const toggleLocation = async () => {
    setLocationError(null);
    if (locationEnabled) {
      await stopFriendLocationSharing();
      return;
    }
    const ok = await startFriendLocationSharing();
    if (!ok) setLocationError(getFriendLocationSharingState().lastError ?? "เปิดแชร์ตำแหน่งไม่สำเร็จ");
  };

  return (
    <div className="rise-in">
      <PageHeader title="เพื่อนและ Streak" subtitle="ให้กำลังใจกัน และแชร์ตำแหน่งได้เมื่อคุณอนุญาต" />

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

      <GlassCard className="mt-4 p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-soft text-sky"><MapPin className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold">แชร์ตำแหน่งแบบเรียลไทม์</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">ปิดเป็นค่าเริ่มต้น และแชร์ได้เฉพาะเพื่อนที่ยืนยันแล้วเท่านั้น</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={locationEnabled}
            onClick={() => void toggleLocation()}
            disabled={!featureFlags.locationSharing}
            className={`press relative h-7 w-12 shrink-0 rounded-full transition-colors ${locationEnabled ? "bg-mint-gradient" : "bg-muted"} disabled:cursor-not-allowed disabled:opacity-50`}
            title={featureFlags.locationSharing ? "เปิด/ปิดแชร์ตำแหน่ง" : "รอ backend realtime location"}
          >
            <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-transform ${locationEnabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-muted/50 px-3 py-3 text-xs">
          <ShieldCheck className="size-4 shrink-0 text-mint" />
          <span>{featureFlags.locationSharing ? (locationWatching ? "กำลังส่งตำแหน่งให้เพื่อนที่ยืนยันแล้ว" : "ยังไม่ได้ส่งตำแหน่ง") : "ระบบนี้ถูกล็อกไว้จนกว่า backend realtime location จะพร้อม"}</span>
          {locationWatching ? <Radio className="ml-auto size-4 animate-pulse text-mint" /> : null}
        </div>
        {locationError ? <p className="mt-2 text-xs text-destructive">{locationError}</p> : null}
      </GlassCard>

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

      <section className="mt-6">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Users className="size-4" /> Streak เพื่อน
        </p>
        {friends.isLoading ? (
          <div className="space-y-2"><Skeleton className="h-16 w-full rounded-2xl" /><Skeleton className="h-16 w-full rounded-2xl" /></div>
        ) : friends.isError ? (
          <ErrorState error={friends.error} onRetry={() => void friends.refetch()} />
        ) : sorted.length === 0 ? (
          <p className="glass-strong rounded-3xl p-6 text-center text-sm text-muted-foreground">ยังไม่มีเพื่อนในระบบ — แชร์โค้ดเชิญให้เพื่อนเริ่มเช็คอินไปด้วยกัน</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((f, i) => {
              const live = liveByFriend.get(f.id);
              const isSelected = selectedFriendId === f.id;
              return (
                <div key={f.id} className="glass-strong rounded-2xl p-3 shadow-soft">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground">#{i + 1}</span>
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-mint-soft text-lg">{f.avatar ?? "🙂"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{f.name}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground"><Flame className="size-3" />{f.streak} วันติด</p>
                    </div>
                    {featureFlags.locationSharing ? (
                      <button
                        type="button"
                        onClick={() => setSelectedFriendId(isSelected ? null : f.id)}
                        className={`press flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium ${isSelected ? "bg-sky-soft text-sky" : "glass"}`}
                      >
                        <MapPin className="size-3.5" /> ตำแหน่ง
                      </button>
                    ) : null}
                    <button
                      onClick={() => cheer.mutate(f.id)}
                      disabled={cheer.isPending}
                      className="press glass flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium text-peach"
                    >
                      <Heart className="size-3.5" /> เชียร์
                    </button>
                  </div>

                  {isSelected && (
                    <div className="mt-3 rounded-2xl bg-sky-soft/60 p-3 text-xs">
                      {!featureFlags.locationSharing ? (
                        <p>ฟีเจอร์ตำแหน่งยังไม่เปิด</p>
                      ) : live ? (
                        <div className="space-y-1">
                          <p className="flex items-center gap-2 font-medium text-sky"><Radio className="size-3.5 animate-pulse" /> ออนไลน์ · อัปเดตล่าสุด {new Date(live.updatedAt).toLocaleTimeString("th-TH")}</p>
                          <p>พิกัด {live.lat.toFixed(5)}, {live.lng.toFixed(5)}</p>
                          {live.accuracy != null ? <p>ความแม่นยำ GPS ±{Math.round(live.accuracy)} ม.</p> : null}
                        </div>
                      ) : liveLocations.isLoading ? (
                        <p>กำลังขอตำแหน่งล่าสุด…</p>
                      ) : liveLocations.isError ? (
                        <p className="text-destructive">ไม่สามารถอ่านตำแหน่งสดได้</p>
                      ) : (
                        <p>เพื่อนยังไม่ได้แชร์ตำแหน่ง หรือไม่มีข้อมูลตำแหน่งล่าสุด</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {featureFlags.locationSharing && (
        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <Square className="size-3" /> ระบบจะหยุดส่งตำแหน่งทันทีเมื่อคุณปิดแชร์
        </div>
      )}
    </div>
  );
}
