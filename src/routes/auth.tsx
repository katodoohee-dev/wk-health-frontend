import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Lock, Mail, User as UserIcon, WifiOff } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/app/theme-toggle";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "เข้าสู่ระบบ — WK Health" },
      { name: "description", content: "เข้าสู่ระบบหรือสมัครสมาชิก WK Health เพื่อบันทึกและติดตามข้อมูลสุขภาพ" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (isAuthenticated) void navigate({ to: "/", replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!busy) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(t);
  }, [busy]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (mode === "register" && cleanName.length < 1) {
      setError("กรุณากรอกชื่อ");
      return;
    }
    if (password.length < 8) {
      setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }

    setBusy(true);
    try {
      if (mode === "login") {
        await login(cleanEmail, password);
      } else {
        // Backend expects displayName. Sending name was silently stripped by Zod.
        await register({ name: cleanName, email: cleanEmail, password });
      }
      await navigate({ to: "/", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rise-in flex min-h-[80vh] flex-col justify-center py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">WK HEALTH / OS</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">{mode === "login" ? "ยินดีต้อนรับกลับ" : "สร้างบัญชีของคุณ"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{mode === "login" ? "เข้าสู่ระบบเพื่อไปต่อ" : "เริ่มบันทึกสุขภาพของคุณ"}</p>
          </div>
          <ThemeToggle />
        </div>

        <div className="glass-strong rounded-[1.75rem] p-5 shadow-soft sm:p-6">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
            {(["login", "register"] as const).map((m) => (
              <button key={m} type="button" disabled={busy} onClick={() => { setMode(m); setError(null); }}
                className={`press rounded-xl py-2.5 text-sm font-medium ${mode === m ? "bg-foreground text-background shadow-sm" : "text-muted-foreground"}`}>
                {m === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "register" && (
              <Field icon={UserIcon} label="ชื่อที่ใช้แสดง" value={name} onChange={setName} placeholder="ชื่อของคุณ" required disabled={busy} />
            )}
            <Field icon={Mail} label="อีเมล" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required disabled={busy} autoComplete="email" />
            <Field icon={Lock} label="รหัสผ่าน" type="password" value={password} onChange={setPassword} placeholder="อย่างน้อย 8 ตัวอักษร" required disabled={busy} autoComplete={mode === "login" ? "current-password" : "new-password"} />

            {error && <div className="flex items-start gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"><WifiOff className="mt-0.5 size-4 shrink-0" /><span>{error}</span></div>}

            <button type="submit" disabled={busy} className="press mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-3.5 font-medium text-background shadow-soft disabled:cursor-wait disabled:opacity-60">
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? "กำลังเชื่อมต่อ…" : mode === "login" ? "เข้าสู่ระบบ" : "สร้างบัญชี"}
            </button>

            {slow && (
              <div className="rounded-2xl bg-muted px-3 py-3 text-center text-xs text-muted-foreground">
                เซิร์ฟเวอร์กำลังตื่นหรือกำลังประมวลผลคำขอแรกอยู่ อาจใช้เวลาสักครู่ — อย่าปิดหน้านี้
              </div>
            )}
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">เชื่อมต่อกับ WK Health API โดยตรง · ข้อมูลยังคงอยู่ในระบบเดิม</p>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, value, onChange, type = "text", placeholder, required, disabled, autoComplete }: {
  icon: typeof Mail; label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean; disabled?: boolean; autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <span className="glass flex items-center gap-2 rounded-2xl px-3 py-1 ring-1 ring-transparent focus-within:ring-primary/30">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <input type={type} value={value} required={required} disabled={disabled} autoComplete={autoComplete} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50" />
      </span>
    </label>
  );
}
