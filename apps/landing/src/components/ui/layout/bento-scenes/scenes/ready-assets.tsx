"use client";

import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBentoMotionGate, useCycleState } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundDots, OverlayContainer, StatusChip } from "../scene-layers";
import { Check, Upload, File, Image, FileText, Folder } from "lucide-react";

/**
 * Scene: Ready Assets
 * Shows upload tray filling with files (brand kit, copy doc, refs, source files)
 */

const assets = [
  { id: "brand", label: "Brand Kit", icon: Folder, color: "text-purple-500" },
  { id: "copy", label: "Copy Doc", icon: FileText, color: "text-blue-500" },
  { id: "refs", label: "References", icon: Image, color: "text-amber-500" },
  { id: "source", label: "Source", icon: File, color: "text-green-500" },
];

export function ReadyAssetsScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { shouldAnimate } = useBentoMotionGate(ref);
  const uploadedCount = useCycleState([0, 1, 2, 3, 4], 1000, shouldAnimate);
  const allUploaded = uploadedCount >= 4;

  return (
    <SceneContainer
      background={<SceneBackgroundDots />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant={allUploaded ? "success" : "default"}>
            {allUploaded ? (
              <>
                <Check className="w-3 h-3" />
                Assets complete
              </>
            ) : (
              <>
                <Upload className="w-3 h-3" />
                {uploadedCount}/4 uploaded
              </>
            )}
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div ref={ref} className="w-full h-full flex flex-col gap-2 px-2 py-1">
        {/* Upload tray */}
        <div className="flex-1 grid grid-cols-2 gap-2">
          {assets.map((asset, i) => {
            const isUploaded = i < uploadedCount;
            const Icon = asset.icon;
            
            return (
              <motion.div
                key={asset.id}
                className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg border-2 border-dashed transition-all ${
                  isUploaded 
                    ? "border-[#9AE83E] bg-[#9AE83E]/10" 
                    : "border-gray-200 bg-gray-50"
                }`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1, duration: 0.3 }}
              >
                {/* File icon */}
                <motion.div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isUploaded ? "bg-[#9AE83E]/20" : "bg-gray-100"
                  }`}
                  animate={isUploaded ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  <Icon className={`w-4 h-4 ${isUploaded ? "text-[#9AE83E]" : asset.color}`} />
                </motion.div>
                
                {/* Label */}
                <span className={`text-[8px] font-medium ${
                  isUploaded ? "text-[#9AE83E]" : "text-gray-500"
                }`}>
                  {asset.label}
                </span>
                
                {/* Status indicator */}
                <AnimatePresence>
                  {isUploaded && (
                    <motion.div
                      className="w-4 h-4 rounded-full bg-[#9AE83E] flex items-center justify-center"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 500 }}
                    >
                      <Check className="w-2.5 h-2.5 text-white" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Status bar */}
        <motion.div
          className={`flex items-center justify-center gap-2 p-2 rounded-lg transition-all ${
            allUploaded 
              ? "bg-[#9AE83E] text-white" 
              : "bg-gray-100 text-gray-500"
          }`}
          animate={allUploaded && shouldAnimate ? { scale: [1, 1.02, 1] } : {}}
          transition={{ duration: 0.5, repeat: allUploaded ? 3 : 0 }}
        >
          <Upload className="w-3 h-3" />
          <span className="text-[10px] font-semibold uppercase tracking-wider">
            {allUploaded ? "Assets Complete" : "Uploading..."}
          </span>
        </motion.div>
      </div>
    </SceneContainer>
  );
}

