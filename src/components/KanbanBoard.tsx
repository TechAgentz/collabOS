"use client";

import { useState } from "react";
import { useDeals } from "@/lib/dealsStore";
import { STAGES, type DealStage } from "@/lib/types";
import DealCard from "./DealCard";

export default function KanbanBoard() {
  const {
    visibleDeals,
    loading,
    loadError,
    retry,
    moveDeal,
    selectedDealId,
    selectDeal,
  } = useDeals();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<DealStage | null>(null);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STAGES.map((s) => (
          <div key={s.id} className="surface-quiet h-72 shimmer" />
        ))}
      </div>
    );
  }

  return (
    <>
      {loadError && (
        <div
          role="alert"
          className="mb-4 flex items-center gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-coral)]/40 bg-[color:var(--color-coral)]/10 px-4 py-3 text-sm text-[color:var(--color-coral)]"
        >
          <span>Couldn&apos;t reach your pipeline. {loadError}</span>
          <button
            onClick={retry}
            className="ml-auto rounded-md border border-[color:var(--color-coral)]/50 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[color:var(--color-coral)]/15"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STAGES.map((stage) => {
          const stageDeals = visibleDeals.filter((d) => d.stage === stage.id);
          const isDropTarget = dragOverStage === stage.id;

          return (
            <section
              key={stage.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage(stage.id);
              }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStage(null);
                const dealId = e.dataTransfer.getData("text/deal-id");
                if (dealId) moveDeal(dealId, stage.id);
              }}
              className={`surface-quiet flex min-h-[20rem] flex-col p-3 transition-colors ${
                isDropTarget
                  ? "!border-[color:var(--color-brass)]/50 !bg-[color-mix(in_oklab,oklch(0.83_0.13_78)_10%,transparent)]"
                  : ""
              }`}
            >
              <header className="mb-3 flex items-center gap-2 px-1.5 pt-1">
                <span className={`h-2 w-2 rounded-full ${stage.accent}`} />
                <h2 className="text-[13px] font-medium tracking-[0.01em] text-white">
                  {stage.label}
                </h2>
                <span className="ml-auto rounded-full border border-[color:var(--color-line)] bg-[color-mix(in_oklab,white_4%,transparent)] px-2 py-0.5 text-[11px] tabular-nums text-[color:var(--color-ink-2)]">
                  {stageDeals.length}
                </span>
              </header>

              <div className="flex flex-1 flex-col gap-2.5">
                {stageDeals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    isDragging={draggingId === deal.id}
                    isActive={selectedDealId === deal.id}
                    onClick={() => selectDeal(deal.id)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/deal-id", deal.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDraggingId(deal.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                  />
                ))}
                {stageDeals.length === 0 && !loadError && (
                  <div className="mt-10 flex flex-col items-center gap-1.5 text-center">
                    <span className="text-[11px] tracking-caps text-[color:var(--color-ink-4)]">
                      Empty
                    </span>
                    <p className="text-xs text-[color:var(--color-ink-3)]">
                      Drop a deal here
                    </p>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
