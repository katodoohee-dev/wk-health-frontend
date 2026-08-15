import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/app/ui-bits";
import { ErrorState } from "@/components/app/states";
import { useAuth } from "@/lib/auth";
import { apiAssistantChat, apiAssistantHistory, type ChatMessage } from "@/lib/api";

const assistantSuggestions = ["สรุปการกินวันนี้ให้หน่อย", "เมนูโปรตีนสูง งบ 60 บาท", "วิ่ง 30 นาที เผาผลาญเท่าไร"];

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "ผู้ช่วย AI โภชนาการ — WK Health App" },
      { name: "description", content: "แชทกับผู้ช่วย AI เพื่อวางแผนมื้ออาหาร ถามเรื่องแคลอรีและสุขภาพ" },
      { property: "og:title", content: "ผู้ช่วย AI โภชนาการ — WK Health App" },
      { property: "og:description", content: "แชทถามเรื่องอาหาร แคลอรี และการวางแผนมื้อ" },
    ],
  }),
  component: AssistantPage,
});

function AssistantPage() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const history = useQuery({ queryKey: ["assistant", "history"], queryFn: apiAssistantHistory, enabled: isAuthenticated });

  const chat = useMutation({
    mutationFn: (message: string) => apiAssistantChat(message),
    onSuccess: (reply) => {
      setPending((p) => [...p, reply]);
      void qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const thread: ChatMessage[] = [...(history.data ?? []), ...pending];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [thread.length, chat.isPending]);
  useEffect(() => { inputRef.current?.focus(); }, [chat.isPending]);

  const send = (value: string) => {
    const v = value.trim();
    if (!v || chat.isPending) return;
    setPending((p) => [...p, { id: `u${Date.now()}`, role: "user", text: v }]);
    setText("");
    chat.mutate(v);
  };

  return (
    <div className="rise-in flex min-h-[calc(100vh-2rem)] flex-col">
      <PageHeader title="ผู้ช่วย AI" emoji="🤖" subtitle="ที่ปรึกษาโภชนาการส่วนตัวของคุณ"
        right={<span className="glass flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-medium"><span className="size-2 rounded-full bg-primary" /> ออนไลน์</span>} />

      <div className="flex-1 space-y-3 pb-4">
        {history.isLoading ? (
          <p className="glass rounded-3xl px-4 py-6 text-center text-sm text-muted-foreground">กำลังโหลดบทสนทนา…</p>
        ) : history.isError ? (
          <ErrorState error={history.error} onRetry={() => void history.refetch()} />
        ) : thread.length === 0 ? (
          <p className="glass-strong rounded-3xl px-4 py-6 text-center text-sm shadow-soft">สวัสดีค่ะ 🌿 ถามเรื่องอาหาร แคลอรี หรือการวางแผนมื้อได้เลยนะคะ</p>
        ) : null}

        {thread.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <span className="mr-2 mt-1 grid size-8 shrink-0 place-items-center rounded-xl bg-mint-soft text-mint"><Sparkles className="size-4" /></span>
            )}
            <p className={`max-w-[80%] rounded-3xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "rounded-br-lg bg-primary text-primary-foreground shadow-glow" : "glass-strong rounded-bl-lg shadow-soft"}`}>
              {m.text}
            </p>
          </div>
        ))}

        {chat.isPending && (
          <div className="flex justify-start">
            <span className="mr-2 mt-1 grid size-8 shrink-0 place-items-center rounded-xl bg-mint-soft text-mint"><Sparkles className="size-4" /></span>
            <p className="glass-strong flex items-center gap-2 rounded-3xl rounded-bl-lg px-4 py-3 text-sm text-muted-foreground shadow-soft">
              <Loader2 className="size-4 animate-spin text-primary" /> กำลังคิด…
            </p>
          </div>
        )}

        {chat.isError && <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{chat.error instanceof Error ? chat.error.message : "ส่งข้อความไม่สำเร็จ"}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-28 space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {assistantSuggestions.map((s) => (<button key={s} onClick={() => send(s)} className="press glass shrink-0 rounded-full px-3.5 py-2 text-xs font-medium">{s}</button>))}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="glass-strong flex items-center gap-2 rounded-3xl p-2 shadow-soft">
          <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="ถามเรื่องอาหารหรือสุขภาพ…"
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground" />
          <button type="submit" disabled={chat.isPending} aria-label="ส่งข้อความ"
            className="press bg-mint-gradient grid size-11 shrink-0 place-items-center rounded-2xl text-primary-foreground shadow-glow disabled:opacity-60">
            {chat.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
