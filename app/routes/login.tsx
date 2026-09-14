import { useState } from "react";
import type { FormEvent, JSX } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "~/shared/hooks/useAuth";
import { useToast } from "~/shared/hooks/useToast";
import { Button } from "~/shared/components/ui/Button";
import { Input } from "~/shared/components/ui/Input";

export function meta(): { title: string }[] {
  return [{ title: "POS Terminal" }];
}

export default function Login(): JSX.Element {
  const { user, loading, signIn } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("cashier@example.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/register" replace />;

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError("");
    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    setBusy(true);
    try {
      await signIn(email, password);
      // Register is the default landing screen after login.
      navigate("/register", { replace: true });
    } catch {
      setError("Sign in failed. Check your email and password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-[340px] p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="text-center mb-8">
          <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-[14px] bg-emerald-700 text-base font-bold text-white">P</span>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">POS Terminal</h1>
          <p className="text-sm text-gray-500">Sign in to open the register</p>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <div>
            <Input
              label="Email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={error}
            />
          </div>
          <Button
            variant="primary"
            size="lg"
            full
            type="submit"
            disabled={busy}
          >
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-gray-600">
          <p>Demo access (API offline)</p>
          <p className="mt-1">Any <span className="font-mono">@example.com</span> email + 4-char password opens demo mode with seeded catalog.</p>
          <p className="mt-2">Live API</p>
          <p className="mt-1">Set <span className="font-mono">VITE_API_URL</span> to your POS-API (default proxies <span className="font-mono">/api → :3000</span>).</p>
        </div>
      </div>
    </div>
  );
}