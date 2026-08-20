import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowUp, Mic, Paperclip, Sparkles } from "lucide-react";
import { assistantHistory, chat } from "@/lib/wk-api";
import { Shell } from "@/components/wk-design";

type Msg = { role: "user" | "assistant"; content: string };

export function LiveAssistant(){
  const [messages,setMessages]=useState<Msg[]>([]);
  const [text,setText]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const inputRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{ void assistantHistory().then(r=>{ if(r.success) setMessages(r.data.messages.map(m=>({role:m.role === "user" ? "user" : "assistant",content:m.content}))); }); },[]);
  async function send(e?:FormEvent){e?.preventDefault(); const message=text.trim(); if(!message||busy)return; setText(""); setError(""); setMessages(m=>[...m,{role:"user",content:message}]); setBusy(true); const r=await chat(message); if(r.success)setMessages(m=>[...m,{role:"assistant",content:r.data.reply}]); else {setError(r.error); setMessages(m=>[...m,{role:"assistant",content:"ตอนนี้ WK เชื่อมต่อโค้ชไม่ได้ ลองอีกครั้งเมื่อ backend พร้อมครับ"}]);} setBusy(false);}
  return <Shell section="CONVERSATION"><div className="wk-page assistant-page"><div className="assistant-grid"><section className="wk-card conversation"><div className="chat-pills"><b>CONTEXT ON</b><span>SLEEP · HRV · LOAD · CALENDAR</span></div><div className="min-h-[460px] space-y-6 overflow-auto pr-2">{messages.length===0&&<div className="py-16 text-center"><Sparkles className="mx-auto mb-4" size={22}/><p className="eyebrow">WK</p><p className="serif-chat">Ask about recovery, training, sleep, food or today.</p></div>}{messages.map((m,i)=><div key={`${i}-${m.content}`}><div className="chat-label">{m.role === "user" ? "YOU" : "WK"}</div>{m.role === "user"?<div className="bubble user">{m.content}</div>:<p className="serif-chat">{m.content}</p>}</div>)}{busy&&<div><div className="chat-label">WK</div><p className="serif-chat opacity-60">Thinking…</p></div>}</div><form onSubmit={send} className="chat-input"><button type="button" onClick={()=>inputRef.current?.click()} aria-label="Attach"><Paperclip size={15}/></button><input ref={inputRef} value={text} onChange={e=>setText(e.target.value)} placeholder="Ask about recovery, training, sleep..."/><button type="submit" disabled={busy||!text.trim()} className="grid size-9 place-items-center rounded-full bg-foreground text-background disabled:opacity-40"><ArrowUp size={15}/></button></form>{error&&<p className="mt-2 text-[10px] text-muted-foreground">{error}</p>}</section><aside className="assistant-side"><section className="wk-card listening"><label>VOICE · READY</label><div className="listen-row"><button type="button" onClick={()=>setText(t=>t?`${t} `:"Hey WK, ")}><Mic size={20}/></button><div><h2>Listening</h2><p>Tap the microphone to start a voice prompt.</p><div className="wave">▂▅▇▂▆▇▃▆▇▂▅▇▃</div></div></div></section><div className="starter"><label>STARTERS</label><h2>Try asking</h2>{["How should I train today?","Why did my sleep change?","Summarise my last 30 days","Build a 20-minute mobility block"].map(t=><button type="button" key={t} onClick={()=>{setText(t);void send()}}>{t}<span>↗</span></button>)}</div></aside></div></div></Shell>
}
