"use client";

import { useDeals } from "@/lib/dealsStore";
import Sidebar from "./Sidebar";
import KanbanBoard from "./KanbanBoard";
import DailySummary from "./DailySummary";
import Analytics from "./Analytics";
import VoiceAssistant from "./VoiceAssistant";
import ConversationPanel from "./ConversationPanel";
import type { ChannelAccounts } from "./SettingsModal";

/**
 * Top hero — big editorial state-of-the-inbox line + a compact "today"
 * counter. Loads-with-content copy so the number never jumps.
 */
function HeroStatus() {
  const { deals, loading } = useDeals();
  const unread = deals.filter((d) => !d.is_read).length;
  const hot = deals.filter((d) => !d.is_read && d.priority === "high").length;

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="shimmer h-8 w-64 rounded-md" />
        <div className="shimmer h-3 w-40 rounded-md opacity-70" />
      </div>
    );
  }

  const headline =
    unread === 0
      ? "You’re all caught up."
      : hot > 0
        ? `${hot} hot pitch${hot > 1 ? "es" : ""} need you.`
        : `${unread} new pitch${unread > 1 ? "es" : ""} waiting.`;

  return (
    <div className="min-w-0">
      <h1 className="text-display text-3xl text-white sm:text-4xl xl:text-5xl">{headline}</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-[color:var(--color-ink-3)]">
        Every pitch, DM and email — extracted by AI into one live pipeline.
      </p>
    </div>
  );
}

export default function DashboardShell({
  email,
  onSignOut,
  accounts,
}: {
  email?: string;
  onSignOut: () => void;
  accounts?: ChannelAccounts;
}) {
  const { query, setQuery } = useDeals();

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const firstName = email
    ? email.split("@")[0].split(/[._\-+]/)[0].replace(/^\w/, (c) => c.toUpperCase())
    : undefined;

  return (
    <div className="mx-auto min-h-screen max-w-[1440px] px-4 pb-40 pt-6 sm:px-6 lg:px-8 lg:pt-8">
      <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-8">
        <Sidebar email={email} onSignOut={onSignOut} accounts={accounts} />

        <main className="mt-6 space-y-8 lg:mt-0">
          {/* Top strip: date + search. Sticky on desktop so search never scrolls away. */}
          <div className="sticky top-0 z-20 -mx-4 flex items-center gap-3 bg-[color-mix(in_oklab,#06090f_78%,transparent)] px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-full lg:border lg:border-[color:var(--color-line)] lg:bg-[color-mix(in_oklab,white_3%,transparent)] lg:px-4 lg:py-2 lg:backdrop-blur-2xl">
            <span className="text-[11px] tracking-caps text-[color:var(--color-ink-3)]">
              {today}
            </span>
            <span className="ml-auto flex flex-1 items-center gap-2 sm:max-w-md">
              <svg className="h-4 w-4 shrink-0 text-[color:var(--color-ink-4)]" viewBox="0 0 20 20" fill="none" aria-hidden>
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="m14 14 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search deals, brands, senders…"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[color:var(--color-ink-4)]"
                aria-label="Search deals"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="rounded-md px-1.5 py-0.5 text-[10px] tracking-caps text-[color:var(--color-ink-3)] transition-colors hover:text-white"
                  aria-label="Clear search"
                >
                  Clear
                </button>
              )}
            </span>
          </div>

          {/* Editorial hero */}
          <section className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <HeroStatus />
            <PipelineDial />
          </section>

          {/* Daily briefing */}
          <DailySummary />

          {/* Analytics rail */}
          <Analytics />

          {/* Pipeline board */}
          <KanbanBoard />
        </main>
      </div>

      {/* Floating overlays */}
      <VoiceAssistant name={firstName} />
      <ConversationPanel />
    </div>
  );
}

/**
 * Tiny hero-aligned KPI — total pipeline value in the display face.
 * The main pipeline number lives in the sidebar; this echoes it so the
 * hero doesn’t feel visually one-sided.
 */
function PipelineDial() {
  const { deals } = useDeals();
  const active = deals.filter((d) => d.stage !== "completed").length;
  const currencies = new Map<string, number>();
  for (const d of deals) {
    if (d.budget == null) continue;
    const cur = d.currency ?? "USD";
    currencies.set(cur, (currencies.get(cur) ?? 0) + d.budget);
  }
  // Show the largest single-currency bucket as the display number.
  // Mixed currencies would otherwise sum-lie.
  let displayValue = 0;
  let displayCurrency = "USD";
  for (const [cur, val] of currencies) {
    if (val > displayValue) {
      displayValue = val;
      displayCurrency = cur;
    }
  }

  const formatted = (() => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: displayCurrency,
        notation: displayValue >= 100_000 ? "compact" : "standard",
        maximumFractionDigits: displayValue >= 100_000 ? 1 : 0,
      }).format(displayValue);
    } catch {
      return `${displayValue} ${displayCurrency}`;
    }
  })();

  return (
    <div className="surface-quiet flex min-w-[220px] flex-col gap-1 px-5 py-4">
      <span className="text-[11px] tracking-caps text-[color:var(--color-ink-3)]">
        {displayCurrency} pipeline
      </span>
      <span className="font-display text-3xl leading-none text-white">{formatted}</span>
      <span className="text-xs text-[color:var(--color-ink-3)]">
        {active} active deal{active === 1 ? "" : "s"}
      </span>
    </div>
  );
}
