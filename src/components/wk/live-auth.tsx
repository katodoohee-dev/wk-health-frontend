import { useState } from "react";
import type { FormEvent } from "react";
import { apiLogin, apiRegister, setToken } from "@/lib/api";

export function LiveAuth(){
  const [mode,setMode]=useState<"login"|"register">("login");
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [name,setName]=useState("");
  const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [done,setDone]=useState(false);
  async function submit(e:FormEvent){
    e.preventDefault();
    if(busy)return;
    setBusy(true); setError(""); setDone(false);
    try{
      const r=mode==="login"
        ? await apiLogin(email,password)
        : await apiRegister({email,password,name});
      if(r.token){
        setToken(r.token);
        setDone(true);
        const next=new URLSearchParams(window.location.search).get("next");
        setTimeout(()=>location.assign(next && next.startsWith("/") ? next : "/"),150);
      }else{
        setError("เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน");
      }
    }catch(err){
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
    }finally{setBusy(false);}
  }
  return <div className="signin"><div className="signin-black"><div className="wk-brand"><div className="wk-mark">WK</div><div><b>WK Health</b><span>HEALTH OS</span></div></div><div><h1>Health, recorded with the patience of a notebook.</h1><p>One continuous record of movement, meals, mood and sound — connected to the live WK Health system.</p></div><small>LIVE　·　SECURE SESSION　·　HEALTH OS</small></div><div className="signin-form"><form onSubmit={submit} className="form-box"><label>{mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}</label><h1>{mode === "login" ? "Welcome back." : "Start your WK workspace."}</h1><p>{mode === "login" ? "Continue to your WK Health workspace." : "Create an account to sync your scans, diary and assistant."}</p>{mode === "register"&&<input value={name} onChange={e=>setName(e.target.value)} placeholder="Name" required/>}<input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email" autoComplete="email" required/><input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password · 8+ characters" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required/><button disabled={busy}>{busy?"Connecting…":mode === "login"?"Continue　↗":"Create account　↗"}</button>{error&&<p className="text-xs text-muted-foreground">{error}</p>}{done&&<p className="text-xs">Session ready. Opening WK…</p>}<div className="or">or</div><button type="button" className="outline" onClick={()=>{setError("");setDone(false);setMode(m=>m==="login"?"register":"login")}}>{mode === "login"?"Create a new account":"I already have an account"}</button></form></div></div>
}
