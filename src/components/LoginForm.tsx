"use client";

import { useState, type FormEvent } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

/**
 * Full-viewport split-screen sign in.
 *   Left  — brand editorial (only shown on lg+); big serif wordmark + quote.
 *   Right — the form.
 *
 * On success, Supabase persists the session and AuthGate's
 * onAuthStateChange listener swaps this view for the dashboard, so there
 * is no navigation to do here.
 */
export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const { error } = await getSupabaseBrowser().auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        // Distinguish "wrong credentials" from an infra/network failure so we
        // don't tell an offline user their (correct) password is wrong. Keep
        // the credentials message generic to avoid email enumeration.
        const status = (error as { status?: number }).status;
        if (error.name === "AuthRetryableFetchError" || status === 429 || (status ?? 0) >= 500) {
          setError("Couldn't reach the server. Check your connection and try again.");
        } else {
          setError("Invalid email or password.");
        }
      }
      // Success: AuthGate reacts to the auth state change and unmounts this form.
    } catch {
      // signInWithPassword re-throws non-Auth errors (e.g. fetch unavailable);
      // without this the button would stay stuck on "Signing in…".
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.15fr_1fr]">
      {/* Editorial pane */}
      <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        {/* Ambient warmth localized to this pane */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage:
              "radial-gradient(700px 500px at 20% 20%, oklch(0.65 0.16 60 / 0.20), transparent 60%), radial-gradient(600px 700px at 80% 90%, oklch(0.55 0.10 260 / 0.22), transparent 60%)",
          }}
        />
        <div className="flex items-center gap-3">
          <BrandMark />
          <span className="font-display text-2xl tracking-tight text-white">CollabOS</span>
        </div>

        <div className="max-w-lg space-y-6">
          <p className="text-display text-5xl leading-[1.05] text-white xl:text-6xl">
            Every pitch,{" "}
            <span className="italic text-[oklch(0.83_0.13_78)]">extracted.</span>
            <br />
            Every deal,{" "}
            <span className="italic text-[oklch(0.83_0.13_78)]">in one place.</span>
          </p>
          <p className="max-w-md text-[15px] leading-relaxed text-[color:var(--color-ink-3)]">
            Gmail, Instagram DMs, WhatsApp — read by AI, sorted by priority, and
            waiting on a single board when you open the app.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[11px] tracking-caps text-[color:var(--color-ink-4)]">
          <span>Made for creators who negotiate their own deals</span>
        </div>
      </aside>

      {/* Form pane */}
      <section className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile brand — only visible when the editorial pane is hidden */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <BrandMark />
            <span className="font-display text-2xl text-white">CollabOS</span>
          </div>

          <div className="mb-8">
            <h1 className="font-display text-3xl text-white">Sign in</h1>
            <p className="mt-1.5 text-sm text-[color:var(--color-ink-3)]">
              to your CollabOS pipeline
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <label className="block">
              <span className="mb-1.5 block text-[11px] tracking-caps text-[color:var(--color-ink-3)]">Email</span>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                aria-invalid={error ? "true" : undefined}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-[11px] tracking-caps text-[color:var(--color-ink-3)]">
                <span>Password</span>
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="rounded-md px-1.5 py-0.5 text-[10px] text-[color:var(--color-ink-3)] transition-colors hover:text-white"
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                aria-invalid={error ? "true" : undefined}
              />
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-md border border-[color:var(--color-coral)]/40 bg-[color:var(--color-coral)]/10 px-3 py-2 text-sm text-[color:var(--color-coral)] animate-fade-in"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !email || !password}
              data-variant="primary"
              className="btn w-full !py-3 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-[11px] tracking-caps text-[color:var(--color-ink-4)]">
            Access is provisioned by your workspace owner
          </p>
        </div>
      </section>
    </div>
  );
}

/* Simple monogram: a warm-brass square with an italic serif "C". */
function BrandMark() {
  return (
    <span
      aria-hidden
      className="grid h-9 w-9 place-items-center rounded-lg"
      style={{
        background:
          "linear-gradient(180deg, oklch(0.83 0.13 78), oklch(0.68 0.15 62))",
        boxShadow:
          "inset 0 1px 0 rgb(255 255 255 / 0.35), 0 6px 18px -6px oklch(0.68 0.15 62 / 0.65)",
      }}
    >
      <span
        className="font-display italic leading-none"
        style={{ color: "#1a1000", fontSize: "20px" }}
      >
        C
      </span>
    </span>
  );
}
