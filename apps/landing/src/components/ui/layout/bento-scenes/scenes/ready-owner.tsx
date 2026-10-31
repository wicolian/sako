"use client";

import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBentoMotionGate, useCycleState } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundGrid, OverlayContainer, StatusChip } from "../scene-layers";
import { Check, User, Users, Crown, MessageSquare } from "lucide-react";

/**
 * Scene: Ready Owner
 * Shows approval lane with avatars, one becomes the designated "Owner"
 */

const reviewers = [
  { id: "r1", name: "Alex", initials: "A", color: "bg-blue-400" },
  { id: "r2", name: "Sam", initials: "S", color: "bg-purple-400" },
  { id: "r3", name: "Jordan", initials: "J", color: "bg-amber-400" },
];

export function ReadyOwnerScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { shouldAnimate } = useBentoMotionGate(ref);
  const stage = useCycleState([0, 1, 2, 3], 1200, shouldAnimate);
  // 0: all reviewers, 1: selecting owner, 2: owner selected, 3: approved

  const ownerIndex = 1; // Sam is the owner
  const isOwnerSelected = stage >= 2;
  const isApproved = stage >= 3;

  return (
    <SceneContainer
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={isApproved ? "success" : "default"}>
            {isApproved ? (
              <>
                <Check className="w-3 h-3" />
                Approved
              </>
            ) : (
              <>
                <User className="w-3 h-3" />
                1 approver
              </>
            )}
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div ref={ref} className="w-full h-full flex flex-col gap-3 px-2 py-2">
        {/* Reviewers row */}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2">
            {reviewers.map((reviewer, i) => {
              const isOwner = i === ownerIndex;
              const isFaded = isOwnerSelected && !isOwner;
              
              return (
                <motion.div
                  key={reviewer.id}
                  className="flex flex-col items-center gap-1"
                  animate={{ 
                    opacity: isFaded ? 0.3 : 1,
                    scale: isOwner && isOwnerSelected ? 1.1 : 1,
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Avatar */}
                  <div className="relative">
                    <motion.div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${reviewer.color}`}
                      animate={isOwner && stage === 1 ? { 
                        boxShadow: ["0 0 0 0 rgba(154, 232, 62, 0)", "0 0 0 4px rgba(154, 232, 62, 0.5)", "0 0 0 0 rgba(154, 232, 62, 0)"],
                      } : {}}
                      transition={{ duration: 0.8, repeat: stage === 1 ? Infinity : 0 }}
                    >
                      {reviewer.initials}
                    </motion.div>
                    
                    {/* Crown for owner */}
                    <AnimatePresence>
                      {isOwner && isOwnerSelected && (
                        <motion.div
                          className="absolute -top-2 -right-1 w-5 h-5 rounded-full bg-[#9AE83E] flex items-center justify-center"
                          initial={{ scale: 0, y: 5 }}
                          animate={{ scale: 1, y: 0 }}
                          exit={{ scale: 0 }}
                          transition={{ type: "spring", stiffness: 500 }}
                        >
                          <Crown className="w-3 h-3 text-white" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  {/* Name */}
                  <span className={`text-[8px] font-medium ${
                    isFaded ? "text-gray-300" : "text-gray-600"
                  }`}>
                    {reviewer.name}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Feedback in dashboard message */}
        <AnimatePresence>
          {isApproved && (
            <motion.div
              className="flex items-center gap-2 p-2 rounded-lg bg-[#9AE83E]/10 border border-[#9AE83E]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <MessageSquare className="w-4 h-4 text-[#9AE83E]" />
              <div className="flex-1">
                <div className="text-[9px] text-[#1a1a1a] font-medium">Feedback in dashboard</div>
                <div className="text-[8px] text-gray-500">Clean approvals, no chaos</div>
              </div>
              <Check className="w-4 h-4 text-[#9AE83E]" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status */}
        <motion.div
          className={`text-center text-[10px] font-medium p-2 rounded ${
            isApproved 
              ? "bg-[#9AE83E] text-white" 
              : isOwnerSelected 
                ? "bg-[#9AE83E]/20 text-[#1a1a1a]" 
                : "bg-gray-100 text-gray-500"
          }`}
        >
          {isApproved ? "Approved by Owner" : isOwnerSelected ? "Owner: Sam" : "Selecting owner..."}
        </motion.div>
      </div>
    </SceneContainer>
  );
}

