import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Lock, Mail, User as UserIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/app/theme-toggle";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "เข้าสู่ระบบ — WK Health App" },
      { name: "description", content: "เข้าสู่ระบบหรือสมัครสมาชิก WK Health App เพื่อบันทึกมื้ออาหารและติดตามสุขภาพของคุณ" },
      { property: "og:title", content: "เข้าสู่ระบบ — WK Health App" },
      { property: "og:description", content: "เข้าสู่ระบบเพื่อเริ่มบันทึกแคลอรีและติดตามสุขภาพ" },
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
    if (!busy) { setSlow(false); return; }
    const t = setTimeout(() => setSlow(true), 2500);
    return () => clearTimeout(t);
  }, [busy]);

  if (isAuthenticated) {
    void navigate({ to: "/", replace: true });
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register({ name: name.trim(), email: email.trim(), password });
      await navigate({ to: "/", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rise-in flex min-h-[80vh] flex-col justify-center py-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-4xl">🥗</p>
          <h1 className="mt-2 font-display text-2xl font-bold">WK Health App</h1>
          <p className="text-sm text-muted-foreground">{mode === "login" ? "ยินดีต้อนรับกลับมา 🌿" : "สร้างบัญชีเพื่อเริ่มดูแลสุขภาพ"}</p>
        </div>
        <ThemeToggle />
      </div>

      <div className="glass-strong rounded-3xl p-5 shadow-soft">
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-muted/60 p-1">
          {(["login", "register"] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setMode(m); setError(null); }}
              className={`press rounded-xl py-2 text-sm font-medium ${mode === m ? "bg-mint-gradient text-primary-foreground shadow-glow" : "text-muted-foreground"}`}>
              {m === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "register" && (
            <Field icon={UserIcon} label="ชื่อที่ใช้แสดง" value={name} onChange={setName} placeholder="เช่น วรกันต์" required />
          )}
          <Field icon={Mail} label="อีเมล" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
          <Field icon={Lock} label="รหัสผ่าน" type="password" value={password} onChange={setPassword} placeholder="อย่างน้อย 6 ตัวอักษร" required />

          {error && <p className="rounded-2xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</p>}

          <button type="submit" disabled={busy} className="press bg-mint-gradient flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-medium text-primary-foreground shadow-glow disabled:opacity-60">
            {busy && <Loader2 className="size-4 animate-spin" />}
            {mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
          </button>

          {slow && (
            <p className="rounded-2xl bg-sky-soft px-3 py-2.5 text-center text-xs text-muted-foreground">
              กำลังเชื่อมต่อเซิร์ฟเวอร์ อาจใช้เวลาสักครู่ (30–60 วินาที) สำหรับคำขอแรก…
            </p>
          )}
        </form>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">ข้อมูลของคุณถูกเก็บบนเซิร์ฟเวอร์ของคุณเอง</p>
    </div>
  );
}

function Field({ icon: Icon, label, value, onChange, type = "text", placeholder, required }: {
  icon: typeof Mail; label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <span className="glass flex items-center gap-2 rounded-2xl px-3 py-1">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <input type={type} value={value} required={required} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground" />
      </span>
    </label>
  );
}
