"use client";

import type { DragEvent } from "react";
import { CHANNEL_LABELS, type Channel, type Deal } from "@/lib/types";

const PRIORITY_TONE: Record<Deal["priority"], "hi" | "md" | "lo"> = {
  high: "hi",
  medium: "md",
  low: "lo",
};

const PRIORITY_LABEL: Record<Deal["priority"], string> = {
  high: "High",
  medium: "Med",
  low: "Low",
};

export function formatBudget(deal: Deal): string | null {
  if (deal.budget == null) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: deal.currency ?? "USD",
      maximumFractionDigits: 0,
    }).format(deal.budget);
  } catch {
    return `${deal.budget} ${deal.currency ?? ""}`.trim();
  }
}

export function ChannelIcon({
  channel,
  className = "h-3.5 w-3.5",
}: {
  channel: Channel;
  className?: string;
}) {
  if (channel === "gmail") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
        <path
          d="M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="m4 7 8 6 8-6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (channel === "instagram") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="3.75" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="16.8" cy="7.2" r="1" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 3.5a8.5 8.5 0 0 0-7.4 12.7L3.5 20.5l4.4-1.1A8.5 8.5 0 1 0 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface DealCardProps {
  deal: Deal;
  isDragging: boolean;
  isActive: boolean;
  onClick: () => void;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}

export default function DealCard({
  deal,
  isDragging,
  isActive,
  onClick,
  onDragStart,
  onDragEnd,
}: DealCardProps) {
  const budget = formatBudget(deal);
  const deadline = deal.deadline
    ? new Date(`${deal.deadline}T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div
      draggable
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={0}
      role="button"
      aria-pressed={isActive}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`card group cursor-grab p-3.5 outline-none active:cursor-grabbing ${
        isDragging ? "rotate-[1deg] opacity-60" : ""
      } ${
        isActive
          ? "!border-[color:var(--color-brass)]/55 shadow-[var(--shadow-3)]"
          : ""
      }`}
    >
      {/* Header — brand + priority */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-[13.5px] font-medium leading-tight text-white">
            {!deal.is_read && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  background: "oklch(0.83 0.13 78)",
                  boxShadow: "0 0 8px oklch(0.83 0.13 78 / 0.6)",
                }}
              />
            )}
            {deal.brand_name}
          </p>
          {deal.contact_name && (
            <p className="mt-0.5 truncate text-[11px] text-[color:var(--color-ink-4)]">
              {deal.contact_name}
            </p>
          )}
        </div>
        <span className="chip" data-tone={PRIORITY_TONE[deal.priority]}>
          {PRIORITY_LABEL[deal.priority]}
        </span>
      </div>

      {/* Body */}
      {deal.summary && (
        <p className="mt-2.5 line-clamp-2 text-[12px] leading-relaxed text-[color:var(--color-ink-3)]">
          {deal.summary}
        </p>
      )}

      {/* Budget block — the anchor. Serif for editorial weight. */}
      {budget && (
        <p
          className="font-display mt-3 text-[18px] leading-none"
          style={{ color: "oklch(0.85 0.13 78)" }}
        >
          {budget}
        </p>
      )}

      {/* Meta strip */}
      <div className="mt-3 flex items-center gap-3 text-[11px] text-[color:var(--color-ink-3)]">
        {deal.deliverables.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden>
              <rect x="1.5" y="2.5" width="9" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.1" />
              <path d="M4 5.5h4M4 7h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
            {deal.deliverables.length}
          </span>
        )}
        {deadline && (
          <span className="inline-flex items-center gap-1">
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden>
              <rect x="1.5" y="2.5" width="9" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.1" />
              <path d="M1.5 5h9M4 1.5v2M8 1.5v2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
            {deadline}
          </span>
        )}
        <span
          className="ml-auto inline-flex items-center"
          title={CHANNEL_LABELS[deal.source_channel]}
          aria-label={CHANNEL_LABELS[deal.source_channel]}
        >
          <ChannelIcon channel={deal.source_channel} className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}
