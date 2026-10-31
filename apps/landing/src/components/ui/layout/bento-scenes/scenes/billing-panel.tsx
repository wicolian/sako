"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { useBentoMotionGate, useCycleState } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundGrid, OverlayContainer, StatusChip } from "../scene-layers";
import { CreditCard, TrendingUp, Check } from "lucide-react";

/**
 * Scene: Billing Panel
 * Shows plan card + usage chip + next invoice preview
 */

export function BillingPanelScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { shouldAnimate } = useBentoMotionGate(ref);
  const usagePercent = useCycleState([45, 52, 58, 63, 45], 1500, shouldAnimate);

  return (
    <SceneContainer
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="success">
            <Check className="w-3 h-3" />
            No surprises
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div ref={ref} className="w-full h-full flex flex-col gap-2 px-2 py-1">
        {/* Plan card */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-[#1a1a1a] to-[#2a2a2a]">
          <div>
            <div className="text-[8px] text-gray-400 uppercase tracking-wider">Current Plan</div>
            <div className="text-sm font-semibold text-white">Pro Team</div>
          </div>
          <div className="px-2 py-0.5 rounded bg-[#9AE83E] text-[8px] font-semibold text-[#1a1a1a]">
            ACTIVE
          </div>
        </div>

        {/* Usage meter */}
        <div className="flex-1 flex flex-col justify-center gap-1">
          <div className="flex items-center justify-between text-[9px]">
            <span className="text-gray-500">Tasks this period</span>
            <span className="font-medium text-[#1a1a1a]">{usagePercent}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#9AE83E] rounded-full"
              animate={{ width: `${usagePercent}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="flex justify-between text-[7px] text-gray-400">
            <span>0</span>
            <span>Unlimited</span>
          </div>
        </div>

        {/* Invoice preview - generic, no sensitive-looking data */}
        <div className="p-2 rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[8px] text-gray-400 uppercase tracking-wider">Next Invoice</span>
            <span className="text-[8px] text-gray-400">1st of month</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <CreditCard className="w-3 h-3 text-gray-400" />
              <span className="text-[10px] text-gray-600">Card on file</span>
            </div>
            <span className="text-xs font-medium text-[#1a1a1a]">
              Flat monthly
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[8px] text-gray-400">
            <TrendingUp className="w-3 h-3 text-[#9AE83E]" />
            SLA-backed. No change orders.
          </div>
        </div>
      </div>
    </SceneContainer>
  );
}

