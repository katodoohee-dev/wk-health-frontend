import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Flame, Heart, Share2, UserPlus, Copy, Loader2, Check, Pencil, X, MapPin, MapPinOff, MessageCircle, Send } from "lucide-react";
import { PageHeader, GlassCard } from "@/components/app/ui-bits";
import { ErrorState, Skeleton } from "@/components/app/states";
import { useAuth } from "@/lib/auth";
import {
  apiFriendsList,
  apiFriendsCheer,
  apiFriendsInviteCode,
  apiFriendsAdd,
  apiStatsWeekSummary,
  apiFriendLocationSharingStatus,
  apiFriendLocationShare,
  apiFriendRename,
  apiFriendMessages,
  apiFriendSendMessage,
  type Friend,
} from "@/lib/api-new-features";
import { renderWeekShareImage, shareOrDownloadImage } from "@/lib/share-image";

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "เพื่อนและ Streak — WK Health App" },
      { name: "description", content: "ดู streak ของเพื่อน ให้กำลังใจกัน และแชร์สรุปสัปดาห์ของคุณ" },
    ],
  }),
  component: FriendsPage,
});

/** avatar ที่อัปโหลดเป็นรูปจะเป็น data URL หรือ http(s) ส่วน emoji เป็น string สั้นๆ ธรรมดา */
function isImageAvatar(a?: string) {
  return !!a && (a.startsWith("data:image") || a.startsWith("http://") || a.startsWith("https://"));
}
function AvatarBubble({ avatar, size = "size-11" }: { avatar?: string; size?: string }) {
  return (
    <span className={`grid ${size} shrink-0 place-items-center overflow-hidden rounded-2xl bg-mint-soft text-lg`}>
      {isImageAvatar(avatar) ? <img src={avatar} alt="" className="size-full object-cover" /> : (avatar ?? "🙂")}
    </span>
  );
}

function FriendsPage() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [editingFriend, setEditingFriend] = useState<Friend | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [viewingFriend, setViewingFriend] = useState<Friend | null>(null);
  // FIX: เพิ่มใหม่ — ช่องแชทคุยกับเพื่อนในแอปโดยตรงตามที่ขอ
  const [chattingFriend, setChattingFriend] = useState<Friend | null>(null);

  const friends = useQuery({ queryKey: ["friends", "list"], queryFn: apiFriendsList, enabled: isAuthenticated });
  const invite = useQuery({ queryKey: ["friends", "invite"], queryFn: apiFriendsInviteCode, enabled: isAuthenticated });
  const week = useQuery({ queryKey: ["stats", "week-summary"], queryFn: apiStatsWeekSummary, enabled: isAuthenticated });

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

  // FIX: เปลี่ยนจากเดิมที่ตั้งชื่อเล่นแบบ local-only (เห็นแค่เครื่องตัวเอง หายถ้าเปลี่ยนอุปกรณ์)
  // มาบันทึกลง backend จริง (ตาราง friendships.nickname) ผ่าน apiFriendRename ที่เพิ่งต่อไว้
  const rename = useMutation({
    mutationFn: ({ id, nickname }: { id: string; nickname: string }) => apiFriendRename(id, nickname),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["friends", "list"] }),
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
        {share.isError && <p className="mt-2 text-xs text-destructive">สร้างรูปไม่สำเร็จ ลองใหม่อีกครั้ง</p>}
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
          <p className="mt-2 text-xs text-destructive">
            {toggleLocationSharing.error instanceof Error ? toggleLocationSharing.error.message : "เปลี่ยนสถานะแชร์ตำแหน่งไม่สำเร็จ ลองใหม่อีกครั้ง"}
          </p>
        )}
        {!toggleLocationSharing.isError && !locationSharing.data?.enabled && (friends.data?.length ?? 0) === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">ต้องมีเพื่อนที่ยืนยันแล้วอย่างน้อย 1 คนก่อนถึงจะเปิดแชร์ตำแหน่งได้ — เพิ่มเพื่อนด้านล่างก่อน</p>
        )}
        {locationSharing.data?.enabled && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            ตำแหน่งจะถูกส่งขึ้นเซิร์ฟเวอร์เฉพาะตอนเปิดหน้า "เดิน/วิ่ง" (GPS) อยู่เท่านั้น เพื่อนที่ยืนยันแล้วถึงจะเห็นหมุดคุณ
          </p>
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
                  <AvatarBubble avatar={f.avatar} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{f.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground"><Flame className="size-3" />{f.streak} วันติด</p>
                  </div>
                </button>
                <button
                  onClick={() => setChattingFriend(f)}
                  className="press glass grid size-8 shrink-0 place-items-center rounded-xl text-sky"
                  aria-label={`แชทกับ ${f.name}`}
                >
                  <MessageCircle className="size-3.5" />
                </button>
                <button
                  onClick={() => { setEditingFriend(f); setNicknameDraft(f.name); }}
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

      {/* modal ตั้งชื่อเล่นเพื่อน — บันทึกลง backend จริงแล้ว */}
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
              maxLength={40}
              className="glass w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            />
            {rename.isError && <p className="mt-2 text-xs text-destructive">บันทึกชื่อเล่นไม่สำเร็จ ลองใหม่อีกครั้ง</p>}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setEditingFriend(null)}
                className="press glass flex-1 rounded-xl py-2.5 text-sm text-muted-foreground"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  const v = nicknameDraft.trim();
                  if (!v || !editingFriend) return;
                  rename.mutate({ id: editingFriend.id, nickname: v }, { onSuccess: () => setEditingFriend(null) });
                }}
                disabled={rename.isPending || !nicknameDraft.trim()}
                className="press bg-mint-gradient flex-1 rounded-xl py-2.5 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-50"
              >
                {rename.isPending ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* modal ดูโปรไฟล์เพื่อน */}
      {viewingFriend && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => setViewingFriend(null)}>
          <div className="glass-strong w-full max-w-sm rounded-3xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setViewingFriend(null)} className="press glass ml-auto grid size-8 place-items-center rounded-xl" aria-label="ปิด"><X className="size-4" /></button>
            <div className="mx-auto"><AvatarBubble avatar={viewingFriend.avatar} size="size-20" /></div>
            <p className="mt-3 font-display text-xl font-bold">{viewingFriend.name}</p>
            <div className="mt-4 rounded-2xl bg-muted/60 px-4 py-3">
              <p className="font-display text-2xl font-bold tabular-nums">{viewingFriend.streak}</p>
              <p className="text-xs text-muted-foreground">วัน streak ติดต่อกัน</p>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => { setChattingFriend(viewingFriend); setViewingFriend(null); }}
                className="press bg-mint-gradient flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-primary-foreground shadow-glow"
              >
                <MessageCircle className="size-3.5" /> แชท
              </button>
              <button
                onClick={() => { setEditingFriend(viewingFriend); setNicknameDraft(viewingFriend.name); setViewingFriend(null); }}
                className="press glass flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium"
              >
                <Pencil className="size-3.5" /> ตั้งชื่อเล่น
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FIX: เพิ่มใหม่ — ช่องแชทคุยกับเพื่อนในแอปตามที่ขอ */}
      {chattingFriend && <FriendChatModal friend={chattingFriend} onClose={() => setChattingFriend(null)} />}
    </div>
  );
}

/** หน้าต่างแชทกับเพื่อนคนหนึ่ง โหลดประวัติ + ส่งข้อความใหม่ + poll ทุก 4 วิเพื่ออัปเดตข้อความที่เพื่อนส่งมา */
function FriendChatModal({ friend, onClose }: { friend: Friend; onClose: () => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = useQuery({
    queryKey: ["friends", "messages", friend.id],
    queryFn: () => apiFriendMessages(friend.id),
    refetchInterval: 4000,
  });

  const send = useMutation({
    mutationFn: (content: string) => apiFriendSendMessage(friend.id, content),
    onSuccess: () => {
      setDraft("");
      void qc.invalidateQueries({ queryKey: ["friends", "messages", friend.id] });
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.data]);

  return (
    <div className="fixed inset-0 z-[210] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="glass-strong flex h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-t-3xl sm:h-[70vh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border/40 p-4">
          <AvatarBubble avatar={friend.avatar} size="size-9" />
          <p className="min-w-0 flex-1 truncate font-display font-semibold">{friend.name}</p>
          <button onClick={onClose} className="press glass grid size-8 shrink-0 place-items-center rounded-xl" aria-label="ปิด"><X className="size-4" /></button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
          {messages.isLoading ? (
            <div className="space-y-2"><Skeleton className="h-10 w-2/3 rounded-2xl" /><Skeleton className="ml-auto h-10 w-2/3 rounded-2xl" /></div>
          ) : messages.isError ? (
            <ErrorState error={messages.error} onRetry={() => void messages.refetch()} />
          ) : !messages.data?.messages.length ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">ยังไม่มีข้อความ — ทักทาย {friend.name} เลยสิ</p>
          ) : (
            messages.data.messages.map((m) => {
              const mine = m.toUserId === friend.id;
              return (
                <div key={m.id} className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "ml-auto bg-mint-gradient text-primary-foreground" : "glass"}`}>
                  {m.content}
                </div>
              );
            })
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); const v = draft.trim(); if (v) send.mutate(v); }}
          className="flex items-center gap-2 border-t border-border/40 p-3"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`ส่งข้อความหา ${friend.name}...`}
            className="glass min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim() || send.isPending}
            className="press bg-mint-gradient grid size-10 shrink-0 place-items-center rounded-xl text-primary-foreground shadow-glow disabled:opacity-50"
            aria-label="ส่ง"
          >
            {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </form>
        {send.isError && <p className="px-3 pb-2 text-xs text-destructive">ส่งข้อความไม่สำเร็จ ลองใหม่อีกครั้ง</p>}
      </div>
    </div>
  );
}
