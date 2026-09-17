import { useEffect, useState } from "react";
import type { FormEvent, JSX } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "~/shared/hooks/useAuth";
import { Button } from "~/shared/components/ui/Button";
import { Input } from "~/shared/components/ui/Input";
import { ApiError } from "~/lib/httpClient";

export function meta(): { title: string }[] {
  return [{ title: "Point of Sale" }];
}

// httpClient's ApiError messages are UI-safe by contract (offline hint,
// rate-limit lockout). Anything else falls back to the generic credential
// error — never leak raw error text to the client.
const GENERIC_SIGNIN_ERROR = "Sign in failed. Check your email and password.";
const NEXT = "/register";
const SAFE = new Set(["NETWORK_OFFLINE", "API_UNREACHABLE", "TOO_MANY_REQUESTS", "UNAUTHENTICATED"]);

const SLIDES = [
  { eyebrow: "◬", title: "Let's Connect →", heading: "Lorem ipsum dolor sit amet", sub: "Fast checkout, accurate stock, and today's sales at a glance." },
  { eyebrow: "◉", title: "Fast Checkout →", heading: "Ring up sales in seconds", sub: "Search, tap, charge — keyboard-first register flow." },
  { eyebrow: "▦", title: "Accurate Stock →", heading: "Know what's on hand", sub: "Live inventory and low-stock alerts per store." },
] as const;

export default function Login(): JSX.Element | null {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [serverUnreachable, setServerUnreachable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const clean = email.trim();

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 4000);
    return () => window.clearInterval(id);
  }, [paused]);

  if (loading) return null;
  if (user) return <Navigate to={NEXT} replace />;

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError("");
    setServerUnreachable(false);
    if (!clean.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length === 0) {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    try {
      await signIn(clean, password);
      navigate(NEXT, { replace: true });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      setServerUnreachable(code === "API_UNREACHABLE" || code === "NETWORK_OFFLINE");
      setError(err instanceof ApiError && SAFE.has(err.code) ? err.message : GENERIC_SIGNIN_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface)] px-4 py-8">
      <div className="grid w-full max-w-[860px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-md)] md:grid-cols-[1fr_1fr]">
        <div className="px-8 py-8 sm:px-10 sm:py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Point of Sale</p>
          <h1 className="sr-only">Point of Sale</h1>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--color-text)]">Login</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-muted)]">To access your personal information, please login with your credentials.</p>
          <form onSubmit={(e) => void onSubmit(e)} noValidate className="mt-6">
            <Input label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus className="rounded-none border-x-0 border-t-0 border-b px-0 focus:ring-0" error={error && !serverUnreachable && !clean.includes("@") ? error : undefined} />
            <div className="mt-4">
              <Input label="Password" type="password" passwordToggle autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-none border-x-0 border-t-0 border-b px-0 focus:ring-0" error={error && !serverUnreachable && clean.includes("@") ? error : undefined} />
            </div>
            <div className="mt-3 flex items-center justify-between text-[13px]">
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-[var(--color-text-muted)]"><input type="checkbox" className="size-3.5 accent-emerald-700" /> Remember me</label>
              <button type="button" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]" onClick={() => setError("Ask an administrator to reset it.")}>Forgot Password?</button>
            </div>
            {error && serverUnreachable ? (
              <p className="mt-3 text-sm text-[var(--color-danger)]" role="alert">{error}</p>
            ) : null}
            <div className="mt-5">
              <Button variant="primary" size="lg" full type="submit" disabled={busy} loading={busy} className="border-0 bg-[#f26d4f] hover:bg-[#e15f41]">{busy ? "Signing in…" : "Sign in"}</Button>
            </div>
          </form>
          <p className="mt-4 text-center text-[13px] text-[var(--color-text-muted)]">Forgot your password? Ask an administrator to reset it.</p>
        </div>
        <div className="hidden flex-col items-center justify-center bg-[#0e8a99] px-8 py-10 text-center text-white md:flex" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
          <div className="w-full max-w-[250px] rounded-md border-[6px] border-white bg-[#f26d4f] px-5 py-7 text-left">
            <p key={`e-${slide}`} className="text-[11px] font-semibold text-white/90 motion-safe:transition-opacity motion-safe:duration-500">{SLIDES[slide].eyebrow}</p>
            <p key={`t-${slide}`} className="mt-1 text-xl font-bold leading-tight motion-safe:transition-opacity motion-safe:duration-500">{SLIDES[slide].title}</p>
          </div>
          <div className="mx-auto mt-1.5 h-1 w-60 rounded-full bg-white/70" />
          <div className="mt-6 min-h-[76px]" aria-live="polite">
            <p key={`h-${slide}`} className="text-[13px] font-semibold motion-safe:transition-opacity motion-safe:duration-500">{SLIDES[slide].heading}</p>
            <p key={`s-${slide}`} className="mx-auto mt-1 max-w-[270px] text-xs leading-relaxed text-white/80 motion-safe:transition-opacity motion-safe:duration-500">{SLIDES[slide].sub}</p>
          </div>
          <div className="mt-5 flex gap-1.5">
            {SLIDES.map((s, i) => (
              <button key={s.title} type="button" tabIndex={0} aria-label={`Go to slide ${i + 1}`} aria-current={i === slide} onClick={() => setSlide(i)} className={`size-1.5 rounded-full transition-colors ${i === slide ? "bg-white" : "bg-white/50 hover:bg-white/80"}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
