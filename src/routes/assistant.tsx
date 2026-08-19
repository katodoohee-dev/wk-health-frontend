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
  head: () => ({ meta: [{ title: "WK Copilot — WK Health" }, { name: "description", content: "ผู้ช่วย AI ส่วนตัวสำหรับสุขภาพและโภชนาการ" }] }),
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
  const chat = useMutation({ mutationFn: (message: string) => apiAssistantChat(message), onSuccess: (reply) => { setPending((p) => [...p, reply]); void qc.invalidateQueries({ queryKey: ["stats"] }); } });
  const thread: ChatMessage[] = [...(history.data ?? []), ...pending];
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [thread.length, chat.isPending]);
  useEffect(() => { inputRef.current?.focus(); }, [chat.isPending]);
  const send = (value: string) => { const v = value.trim(); if (!v || chat.isPending) return; setPending((p) => [...p, { id: `u${Date.now()}`, role: "user", text: v }]); setText(""); chat.mutate(v); };

  return (
    <div className="rise-in flex min-h-[calc(100vh-2rem)] flex-col">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div><p className="label-editorial mb-2">WK INTELLIGENCE</p><h1 className="font-display text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">WK Copilot</h1><p className="mt-2 text-sm text-muted-foreground">พื้นที่สำหรับคิด วางแผน และเข้าใจสุขภาพของคุณ</p></div>
        <span className="hidden items-center gap-2 rounded-full border border-hairline bg-surface-1 px-3 py-2 text-xs font-medium sm:flex"><span className="size-1.5 rounded-full bg-foreground" /> Online</span>
      </header>

      <div className="flex-1 space-y-4 pb-5">
        {history.isLoading ? <p className="rounded-3xl border border-hairline bg-surface-1 px-4 py-8 text-center text-sm text-muted-foreground">กำลังโหลดบทสนทนา…</p> : history.isError ? <ErrorState error={history.error} onRetry={() => void history.refetch()} /> : thread.length === 0 ? (
          <div className="rounded-[2rem] border border-hairline bg-surface-1 p-7 sm:p-10"><div className="mb-8 grid size-12 place-items-center rounded-2xl bg-foreground text-background"><Sparkles className="size-5" /></div><p className="label-editorial mb-2">READY WHEN YOU ARE</p><h2 className="font-display text-2xl font-semibold tracking-[-0.04em]">ถาม WK ได้ทุกเรื่องที่เกี่ยวกับสุขภาพ</h2><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">จากอาหาร การออกกำลังกาย ไปจนถึงภาพรวมของวันนี้</p></div>
        ) : null}

        {thread.map((m) => <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
          {m.role === "assistant" && <span className="mr-3 mt-1 grid size-8 shrink-0 place-items-center rounded-xl border border-hairline bg-surface-1"><Sparkles className="size-4" /></span>}
          <p className={`max-w-[82%] whitespace-pre-wrap rounded-3xl px-4 py-3.5 text-sm leading-6 ${m.role === "user" ? "rounded-br-lg bg-foreground text-background" : "rounded-bl-lg border border-hairline bg-surface-1"}`}>{m.text}</p>
        </div>)}
        {chat.isPending && <div className="flex justify-start"><span className="mr-3 mt-1 grid size-8 place-items-center rounded-xl border border-hairline bg-surface-1"><Sparkles className="size-4" /></span><p className="flex items-center gap-2 rounded-3xl rounded-bl-lg border border-hairline bg-surface-1 px-4 py-3.5 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> WK กำลังคิด…</p></div>}
        {chat.isError && <p className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{chat.error instanceof Error ? chat.error.message : "ส่งข้อความไม่สำเร็จ"}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-28 space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">{assistantSuggestions.map((s) => <button key={s} onClick={() => send(s)} className="press shrink-0 rounded-full border border-hairline bg-surface-1 px-3.5 py-2 text-xs font-medium hover:bg-surface-2">{s}</button>)}</div>
        <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex items-center gap-2 rounded-[1.5rem] border border-hairline bg-background p-2 shadow-soft">
          <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask WK anything…" aria-label="ถาม WK" className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-muted-foreground" />
          <button type="submit" disabled={chat.isPending} aria-label="ส่งข้อความ" className="press grid size-11 shrink-0 place-items-center rounded-xl bg-foreground text-background disabled:opacity-50">{chat.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}</button>
        </form>
      </div>
    </div>
  );
}
