"use client";

import { useState, type FormEvent } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { BotMark } from "./BotBackdrop";

/**
 * Sign-in: a single frosted-glass card over the robot backdrop, with a
 * short pitch beside it on wide screens.
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
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        {/* Pitch — wide screens only */}
        <section className="hidden lg:block">
          <div className="mb-8 flex items-center gap-3">
            <BotMark size={44} />
            <span className="text-2xl font-bold tracking-tight text-white">CollabOS</span>
          </div>
          <h1 className="text-display text-5xl text-white">
            Your AI deal manager,
            <br />
            <span className="text-gradient">always on.</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-[color:var(--color-ink-2)]">
            Gmail, Instagram DMs and WhatsApp, read by AI, sorted by priority and
            waiting on one board when you open the app.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-[color:var(--color-ink-2)]">
            {[
              "Pitches extracted into brand, budget and deadline",
              "Live Kanban pipeline across every channel",
              "Voice briefing from your AI talent manager",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="grid h-6 w-6 place-items-center rounded-full border border-[color:var(--color-line)] bg-white/10">
                  <svg className="h-3.5 w-3.5 text-[color:var(--color-accent)]" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Glass form card */}
        <section className="glass mx-auto w-full max-w-md p-8 sm:p-10">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BotMark size={40} />
            <span className="text-xl font-bold tracking-tight text-white">CollabOS</span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white">Welcome back</h2>
          <p className="mt-1.5 text-sm text-[color:var(--color-ink-3)]">Sign in to your pipeline</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-[color:var(--color-ink-2)]">Email</span>
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
              <span className="mb-2 flex items-center justify-between text-xs font-semibold text-[color:var(--color-ink-2)]">
                <span>Password</span>
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="rounded-md px-1.5 py-0.5 text-xs font-medium text-[color:var(--color-accent)] transition-opacity hover:opacity-80"
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
                className="animate-fade-in rounded-xl border border-[color:var(--color-coral)]/50 bg-[color:var(--color-coral)]/15 px-3 py-2.5 text-sm text-[color:var(--color-coral)]"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !email || !password}
              data-variant="primary"
              className="btn w-full !py-3.5 !text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-[color:var(--color-ink-4)]">
            Access is provisioned by your workspace owner
          </p>
        </section>
      </div>
    </div>
  );
}
