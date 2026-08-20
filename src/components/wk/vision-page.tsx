import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, BookOpen, Camera, Check, Clock3, Dumbbell, Footprints, HeartPulse, Images, Loader2, MessageSquare, Music, RefreshCw, Send, ShieldCheck, Sparkles, Users, Wallet } from "lucide-react";
import { AppShell } from "@/components/wk/shell";
import { Action, DataRow, Metric, Panel, PageHeader, SectionHeader, StatusIndicator, Timeline } from "@/components/wk/ui";
import { apiFetch, todayISO } from "@/lib/api";

type Json = Record<string, unknown>;
type PageConfig = { eyebrow:string; title:string; description:string; icon:typeof Activity; endpoint:string };
const config:Record<string,PageConfig>={
 diary:{eyebrow:"Today / Diary",title:"A record worth keeping.",description:"Meals, notes and observations from your real WK Health record.",icon:Clock3,endpoint:"/api/diary?date="},
 mood:{eyebrow:"Mind / Mood",title:"Notice the quieter signals.",description:"Your saved mood and check-in data.",icon:HeartPulse,endpoint:"/api/mood"},
 music:{eyebrow:"Environment / Sound",title:"Make the room work for you.",description:"Music data from the WK Health backend.",icon:Music,endpoint:"/api/music"},
 workout:{eyebrow:"Movement / Training",title:"Strength, without the noise.",description:"Training sessions stored in your account.",icon:Dumbbell,endpoint:"/api/workout"},
 budget:{eyebrow:"Life / Budget",title:"Spend with the same clarity.",description:"Your saved budget records.",icon:Wallet,endpoint:"/api/budget"},
 "device-connect":{eyebrow:"Intelligence / Devices",title:"Bring your signals together.",description:"Connected-device records available from the backend.",icon:Activity,endpoint:"/api/body"},
 assistant:{eyebrow:"Intelligence / Assistant",title:"Ask better questions.",description:"A live conversational layer backed by your saved context.",icon:MessageSquare,endpoint:"/api/assistant/history?limit=50"},
 nlp:{eyebrow:"Intelligence / Language",title:"Write it once. Let it resolve.",description:"Natural-language health processing from the backend.",icon:Sparkles,endpoint:"/api/nlp"},
 pedometer:{eyebrow:"Movement / Pedometer",title:"Keep moving, gently.",description:"Step and movement records from your account.",icon:Footprints,endpoint:"/api/pedometer"},
 gallery:{eyebrow:"Life / Gallery",title:"The visual memory of the day.",description:"Your stored gallery records.",icon:Images,endpoint:"/api/gallery"},
 friends:{eyebrow:"Life / Friends",title:"Health is not a solo metric.",description:"Friends and social records from the backend.",icon:Users,endpoint:"/api/friends"},
 export:{eyebrow:"Account / Export",title:"Your record stays yours.",description:"Export jobs and available account data.",icon:Camera,endpoint:"/api/export"},
 profile:{eyebrow:"Account / Profile",title:"Your settings, in plain sight.",description:"Your real account profile.",icon:ShieldCheck,endpoint:"/api/auth/me"},
 notifications:{eyebrow:"Account / Notifications",title:"Only what deserves your attention.",description:"Notification data from the backend.",icon:Activity,endpoint:"/api/notifications"},
};

function extractRows(value:unknown):Json[]{
 if(Array.isArray(value)) return value.filter((x):x is Json=>!!x&&typeof x==="object");
 if(value&&typeof value==="object"){
  const o=value as Json;
  for(const key of ["items","data","rows","entries","messages","notifications","friends","workouts","records","results"]){if(Array.isArray(o[key])) return extractRows(o[key]);}
  return [o];
 }
 return [];
}
function pretty(value:unknown){if(value===null||value===undefined)return "—";if(typeof value==="string"||typeof value==="number"||typeof value==="boolean")return String(value);return JSON.stringify(value);}

export function VisionPage({page}:{page:string}){
 const c=config[page]??{eyebrow:"WK Health / Vision",title:"A calmer way to hold your health.",description:"Live account data.",icon:BarChart3,endpoint:"/api/stats/today"};
 const [data,setData]=useState<unknown>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [message,setMessage]=useState(""); const [reply,setReply]=useState(""); const [sending,setSending]=useState(false);
 const load=useCallback(async()=>{setLoading(true);setError("");try{const endpoint=c.endpoint.endsWith("=")?`${c.endpoint}${encodeURIComponent(todayISO())}`:c.endpoint;setData(await apiFetch(endpoint));}catch(e){setError(e instanceof Error?e.message:"โหลดข้อมูลไม่สำเร็จ");setData(null);}finally{setLoading(false);}},[c.endpoint]);
 useEffect(()=>{load();},[load]);
 const rows=useMemo(()=>extractRows(data),[data]);
 async function ask(){if(!message.trim())return;setSending(true);setError("");try{const r=await apiFetch<Json>("/api/assistant/chat",{method:"POST",body:{message:message.trim()}});setReply(String(r.reply??r.data??"ได้รับคำตอบแล้ว"));setMessage("");if(page==="assistant")await load();}catch(e){setError(e instanceof Error?e.message:"ส่งข้อความไม่สำเร็จ");}finally{setSending(false);}}
 return <AppShell title={c.eyebrow.split(" / ").pop()}><PageHeader eyebrow={c.eyebrow} title={c.title} description={c.description} actions={<div className="flex items-center gap-2"><StatusIndicator label={loading?"Syncing":"Live API"} state={loading?"live":"idle"}/><Action icon={RefreshCw} size="sm" onClick={load} disabled={loading} aria-label="Refresh"/></div>}/><div className="grid gap-8 py-10 lg:grid-cols-[1.3fr_.7fr]"><div className="space-y-8"><Panel tone="ink" className="min-h-[240px] border-transparent"><div className="flex h-full flex-col justify-between gap-12"><div className="flex items-center justify-between"><c.icon className="size-5" strokeWidth={1.4}/><span className="num text-[10px] opacity-60">LIVE / API</span></div><div><p className="display text-4xl sm:text-5xl">Connected to your record.</p><p className="mt-4 max-w-xl text-sm leading-6 opacity-65">This surface reads from the WK Health backend. No illustrative health numbers are used here.</p></div></div></Panel>{page==="assistant"&&<Panel title="Ask WK Health"><div className="flex gap-2"><input value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void ask()}} placeholder="ถามเรื่องสุขภาพของคุณ…" className="min-w-0 flex-1 border-b border-border bg-transparent px-1 py-3 text-sm outline-none focus:border-foreground"/><Action icon={sending?Loader2:Send} variant="solid" onClick={ask} disabled={sending||!message.trim()}>{sending?"กำลังคิด":"ส่ง"}</Action></div>{reply&&<div className="mt-5 border-l-2 border-signal pl-4 text-sm leading-6">{reply}</div>}</Panel>}{error?<Panel><div className="border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><p className="font-medium">ไม่สามารถโหลดข้อมูลจาก backend</p><p className="mt-1 text-xs opacity-80">{error}</p></div></Panel>:<div><SectionHeader title="Backend data" meta={`${rows.length} records`}/><Panel bare className="px-5 py-2">{loading?<div className="flex items-center gap-3 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin"/>กำลังซิงก์ข้อมูล…</div>:rows.length===0?<div className="py-8 text-sm text-muted-foreground">ยังไม่มีข้อมูลที่บันทึกไว้</div>:rows.slice(0,20).map((row,i)=><DataRow key={i} label={String(row.name??row.title??row.role??row.type??`Record ${i+1}`)} value={String(row.value??row.status??row.created_at??row.createdAt??"Saved")} meta={String(row.date??row.time??"")} icon={i===0?Check:undefined}/>)}</Panel></div>}</div><div className="space-y-8"><Panel title="Connection"><Metric label="Records returned" value={loading?"—":String(rows.length)} size="xl"/><div className="mt-6"><DataRow label="Endpoint" value={c.endpoint.replace("/api/","")} /><DataRow label="Date" value={todayISO()} /><DataRow label="Status" value={error?"Error":"Connected"} icon={error?undefined:Check}/></div></Panel><Panel title="Raw response" bare><pre className="max-h-[360px] overflow-auto p-5 text-[10px] leading-5 text-muted-foreground">{pretty(data)}</pre></Panel></div></div></AppShell>;
}
