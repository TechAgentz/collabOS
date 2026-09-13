"use client";

import { useState } from "react";
import { useDeals, type ChannelFilter } from "@/lib/dealsStore";
import { STAGES, CHANNEL_LABELS, type Channel } from "@/lib/types";
import { ChannelIcon } from "./DealCard";
import SettingsModal, { type ChannelAccounts } from "./SettingsModal";

const CHANNELS: Channel[] = ["gmail", "instagram", "whatsapp"];

/**
 * Currency compaction with graceful fallback.
 * Mixed-currency pipelines: sum in "primary" bucket only (largest by value)
 * would be more honest, but the sidebar deliberately shows one aggregate
 * number so it never lies about "USD 482,500" when half the deals are INR.
 * The hero handles the honest per-currency version — this one is a rough
 * cross-currency sum for hierarchy only.
 */
function compactValue(n: number): string {
  try {
    return new Intl.NumberFormat("en-US", {
      notation: n >= 100_000 ? "compact" : "standard",
      maximumFractionDigits: n >= 100_000 ? 1 : 0,
    }).format(n);
  } catch {
    return `${n}`;
  }
}

function displayName(email?: string): string {
  if (!email) return "Your workspace";
  const local = email.split("@")[0];
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Sidebar({
  email,
  onSignOut,
  accounts = {},
}: {
  email?: string;
  onSignOut: () => void;
  accounts?: ChannelAccounts;
}) {
  const { deals, channelFilter, setChannelFilter } = useDeals();
  const [showSettings, setShowSettings] = useState(false);

  const totalValue = deals.reduce((s, d) => s + (d.budget ?? 0), 0);
  const unread = deals.filter((d) => !d.is_read).length;
  const active = deals.filter((d) => d.stage !== "completed").length;
  const maxStage = Math.max(1, ...STAGES.map((s) => deals.filter((d) => d.stage === s.id).length));

  const channelCount = (c: ChannelFilter) =>
    c === "all" ? deals.length : deals.filter((d) => d.source_channel === c).length;

  return (
    <aside className="glass flex flex-col gap-6 p-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-1 pt-1">
        <BrandMark />
        <span className="font-display text-xl leading-none text-white">CollabOS</span>
      </div>

      {/* Profile chip */}
      <div className="surface-inset flex items-center gap-3 px-3 py-2.5">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold text-[#1a1000]"
          style={{
            background:
              "linear-gradient(180deg, oklch(0.85 0.13 78), oklch(0.68 0.15 62))",
            boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.35)",
          }}
        >
          {(email?.[0] ?? "?").toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{displayName(email)}</p>
          <p className="truncate text-[11px] text-[color:var(--color-ink-4)]">
            {email ?? "Signed in"}
          </p>
        </div>
      </div>

      {/* Pipeline number — the "big display moment" */}
      <div className="px-1">
        <p className="text-[10px] tracking-caps text-[color:var(--color-ink-4)]">
          Pipeline value
        </p>
        <p className="font-display mt-1 text-4xl leading-none text-white">
          {compactValue(totalValue)}
        </p>
        <div className="mt-3 flex items-center gap-4 text-[11px] tracking-caps text-[color:var(--color-ink-3)]">
          <span>
            <span className="text-white">{active}</span> active
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.83_0.13_78)]" />
            <span className="text-white">{unread}</span> unread
          </span>
        </div>
      </div>

      <div className="hairline" />

      {/* Stage distribution */}
      <div>
        <p className="mb-3 px-1 text-[10px] tracking-caps text-[color:var(--color-ink-4)]">Stages</p>
        <div className="space-y-3">
          {STAGES.map((stage) => {
            const count = deals.filter((d) => d.stage === stage.id).length;
            return (
              <div key={stage.id} className="flex items-center gap-3">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${stage.accent}`} />
                <span className="w-20 shrink-0 truncate text-xs text-[color:var(--color-ink-2)]">
                  {stage.label}
                </span>
                <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full ${stage.accent}`}
                    style={{ width: `${(count / maxStage) * 100}%`, opacity: 0.8 }}
                  />
                </div>
                <span className="w-4 shrink-0 text-right text-xs tabular-nums text-[color:var(--color-ink-3)]">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="hairline" />

      {/* Connected accounts / channel filter */}
      <div>
        <div className="mb-3 flex items-center justify-between px-1">
          <p className="text-[10px] tracking-caps text-[color:var(--color-ink-4)]">
            Connected accounts
          </p>
          <button
            onClick={() => setShowSettings(true)}
            aria-label="Edit connected accounts"
            className="text-[color:var(--color-ink-4)] transition-colors hover:text-white"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-1">
          <ChannelRow
            active={channelFilter === "all"}
            onClick={() => setChannelFilter("all")}
            label="All channels"
            count={channelCount("all")}
            icon={
              <span className="grid h-4 w-4 place-items-center text-[color:var(--color-ink-3)]">
                ◎
              </span>
            }
          />

          {CHANNELS.map((c) => {
            const count = channelCount(c);
            const connected = count > 0;
            const isActive = channelFilter === c;
            const account =
              accounts[c] ||
              (connected ? (c === "gmail" ? email : "Linked via n8n") : null);
            return (
              <ChannelRow
                key={c}
                active={isActive}
                onClick={() => setChannelFilter(c)}
                label={CHANNEL_LABELS[c]}
                count={count}
                sub={account ?? undefined}
                status={connected ? "active" : "off"}
                icon={<ChannelIcon channel={c} className="h-4 w-4 text-[color:var(--color-ink-2)]" />}
              />
            );
          })}
        </div>
      </div>

      {/* Sign out — pinned bottom */}
      <div className="mt-auto">
        <div className="hairline mb-4" />
        <button
          onClick={onSignOut}
          className="btn w-full text-xs"
          data-variant="ghost"
        >
          Sign out
        </button>
      </div>

      {showSettings && (
        <SettingsModal accounts={accounts} onClose={() => setShowSettings(false)} />
      )}
    </aside>
  );
}

/* ------- helpers ------- */

function ChannelRow({
  active,
  onClick,
  label,
  count,
  sub,
  status,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  sub?: string;
  status?: "active" | "off";
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-[var(--radius-md)] px-2.5 py-2 text-left transition-colors ${
        active
          ? "bg-[color-mix(in_oklab,white_8%,transparent)] ring-1 ring-[color:var(--color-line-2)]"
          : "hover:bg-[color-mix(in_oklab,white_4%,transparent)]"
      }`}
    >
      <span className="mt-0.5">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm text-white">
          {label}
          {status && (
            <span
              className="text-[9px] tracking-caps"
              style={{
                color:
                  status === "active"
                    ? "oklch(0.78 0.135 155)"
                    : "oklch(0.44 0.02 260)",
              }}
            >
              {status === "active" ? "● active" : "○ not linked"}
            </span>
          )}
        </span>
        {sub && (
          <span className="mt-0.5 block truncate text-[11px] text-[color:var(--color-ink-4)]">
            {sub}
          </span>
        )}
      </span>
      <span className="self-center text-xs tabular-nums text-[color:var(--color-ink-3)]">
        {count}
      </span>
    </button>
  );
}

function BrandMark() {
  return (
    <span
      aria-hidden
      className="grid h-8 w-8 place-items-center rounded-md"
      style={{
        background:
          "linear-gradient(180deg, oklch(0.85 0.13 78), oklch(0.68 0.15 62))",
        boxShadow:
          "inset 0 1px 0 rgb(255 255 255 / 0.35), 0 4px 12px -4px oklch(0.68 0.15 62 / 0.5)",
      }}
    >
      <span
        className="font-display italic leading-none"
        style={{ color: "#1a1000", fontSize: "18px" }}
      >
        C
      </span>
    </span>
  );
}
