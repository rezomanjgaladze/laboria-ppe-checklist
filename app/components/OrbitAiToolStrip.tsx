"use client";

import { useEffect, useState } from "react";
import { Coins, Lock, Sparkles } from "lucide-react";
import OrbitAiModal from "@/app/components/OrbitAiModal";
import {
  getOrbitAiAccount,
  getOrbitAiTool,
  orbitAiAccountUpdatedEvent,
  type OrbitAiContext,
  type OrbitAiSourceModule,
  type OrbitAiToolId,
} from "@/app/lib/orbitAi";
import type { OrbitAiStructuredRiskAssessment } from "@/app/lib/orbitAiRiskAssessment";

type OrbitAiToolStripProps = {
  darkMode: boolean;
  userId?: string | null;
  toolIds: OrbitAiToolId[];
  context?: OrbitAiContext;
  title?: string;
  compact?: boolean;
  sourceModule?: OrbitAiSourceModule;
  onRiskAssessmentGenerated?: (
    assessment: OrbitAiStructuredRiskAssessment,
  ) => boolean;
};

const joinClasses = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export default function OrbitAiToolStrip({
  darkMode,
  userId = null,
  toolIds,
  context,
  title = "Orbit AI Tools",
  compact = false,
  sourceModule,
  onRiskAssessmentGenerated,
}: OrbitAiToolStripProps) {
  const [activeToolId, setActiveToolId] = useState<OrbitAiToolId | null>(null);
  const [account, setAccount] = useState(() => getOrbitAiAccount(userId));

  useEffect(() => {
    const syncAccount = () => setAccount(getOrbitAiAccount(userId));

    syncAccount();
    window.addEventListener(orbitAiAccountUpdatedEvent, syncAccount);

    return () => {
      window.removeEventListener(orbitAiAccountUpdatedEvent, syncAccount);
    };
  }, [userId]);

  return (
    <>
      <div
        className={joinClasses(
          "rounded-2xl border",
          compact ? "p-2.5" : "p-3",
          darkMode
            ? "border-[#4DEBFF]/16 bg-[#4DEBFF]/[0.045]"
            : "border-[#1E90FF]/16 bg-[#1E90FF]/[0.045]",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={joinClasses(
              "mr-1 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em]",
              darkMode ? "text-[#4DEBFF]" : "text-[#1E90FF]",
            )}
          >
            <Sparkles size={13} aria-hidden />
            {title}
          </span>
          {toolIds.map((toolId) => {
            const tool = getOrbitAiTool(toolId);
            const credits = tool.getCredits(context);
            const available = account.credits >= credits;

            return (
              <button
                key={tool.id}
                type="button"
                className={joinClasses(
                  "group inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-2.5 py-2 text-left text-xs font-semibold transition",
                  "hover:-translate-y-0.5 hover:border-[#4DEBFF]/45 hover:shadow-[0_10px_28px_rgba(77,235,255,0.10)] focus:outline-none focus:ring-2 focus:ring-[#4DEBFF]/45",
                  darkMode
                    ? "border-white/10 bg-white/[0.045] text-slate-100"
                    : "border-slate-200 bg-white text-slate-700",
                )}
                onClick={() => setActiveToolId(tool.id)}
              >
                {available ? (
                  <Sparkles size={13} className="shrink-0 text-[#4DEBFF]" aria-hidden />
                ) : (
                  <Lock size={13} className="shrink-0 text-amber-400" aria-hidden />
                )}
                <span>{tool.title}</span>
                <span
                  className={joinClasses(
                    "inline-flex items-center gap-1 whitespace-nowrap text-[10px]",
                    darkMode ? "text-[#4DEBFF]" : "text-[#1E90FF]",
                  )}
                >
                  <Coins size={11} aria-hidden />
                  {credits} Credits
                </span>
                <span
                  className={joinClasses(
                    "whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]",
                    available
                      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-500"
                      : "border-amber-400/25 bg-amber-500/10 text-amber-500",
                  )}
                >
                  {available ? "Available" : "Locked"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <OrbitAiModal
        darkMode={darkMode}
        userId={userId}
        toolId={activeToolId}
        context={context}
        sourceModule={sourceModule}
        onRiskAssessmentGenerated={onRiskAssessmentGenerated}
        onClose={() => setActiveToolId(null)}
      />
    </>
  );
}
