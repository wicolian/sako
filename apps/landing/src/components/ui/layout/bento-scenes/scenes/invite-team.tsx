"use client";

/**
 * Invite Team Scene
 * Shows team roles with submit/review lanes
 * 
 * Key fix: Deterministic initial state for SSR
 */

import { useRef } from "react";
import { motion } from "framer-motion";
import { useBentoMotionGate, useCycleState } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundGrid, StatusChip, OverlayContainer } from "../scene-layers";
import { cn } from "@/lib/utils";
import { Users, Send, Eye, CheckCircle } from "lucide-react";

const TEAM_MEMBERS = [
  { uid: "m1", initials: "JD", role: "Submitter", color: "bg-blue-500" },
  { uid: "m2", initials: "KS", role: "Reviewer", color: "bg-purple-500" },
  { uid: "m3", initials: "AM", role: "Viewer", color: "bg-gray-400" },
];

const ROLE_ICONS = {
  Submitter: Send,
  Reviewer: CheckCircle,
  Viewer: Eye,
};

export function InviteTeamScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, prefersReducedMotion } = useBentoMotionGate(containerRef);
  
  // Animate which member is highlighted
  const activeIndex = useCycleState([0, 1, 2, 0], 1500, shouldAnimate && !prefersReducedMotion);

  return (
    <SceneContainer
      ref={containerRef}
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="default" animate={shouldAnimate}>
            <Users className="w-3 h-3" />
            {TEAM_MEMBERS.length} members
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div className="flex flex-col h-full justify-center gap-2 px-2">
        <div className="text-[9px] font-medium text-gray-500 uppercase tracking-wider mb-1">Team Access</div>
        
        {TEAM_MEMBERS.map((member, i) => {
          const Icon = ROLE_ICONS[member.role as keyof typeof ROLE_ICONS];
          const isActive = i === activeIndex;
          
          return (
            <motion.div
              key={member.uid}
              className={cn(
                "flex items-center gap-3 p-2 rounded-lg border transition-all",
                isActive 
                  ? "bg-[#1a1a1a] border-[#1a1a1a]" 
                  : "bg-white border-gray-100"
              )}
              initial={shouldAnimate ? { opacity: 0, x: -10 } : undefined}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1, duration: 0.3 }}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-semibold",
                member.color
              )}>
                {member.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn(
                  "text-[10px] font-medium",
                  isActive ? "text-white" : "text-[#1a1a1a]"
                )}>
                  {member.role}
                </div>
              </div>
              <Icon className={cn(
                "w-4 h-4",
                isActive ? "text-[#9AE83E]" : "text-gray-400"
              )} />
            </motion.div>
          );
        })}
        
        {/* Add member button */}
        <motion.div
          className="flex items-center justify-center gap-1 p-2 rounded-lg border border-dashed border-gray-300 text-gray-400"
          whileHover={shouldAnimate ? { borderColor: "#1a1a1a", color: "#1a1a1a" } : undefined}
        >
          <span className="text-[10px]">+ Invite</span>
        </motion.div>
      </div>
    </SceneContainer>
  );
}

export default InviteTeamScene;

