"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { useBentoMotionGate, useCycleState } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundGrid, OverlayContainer, StatusChip, WindowFrame } from "../scene-layers";
import { Palette, Check } from "lucide-react";

/**
 * Scene: Brand Profiles
 * Shows tabs for brands, switching recolors the mini UI with tokens
 */

const brands = [
  { 
    name: "Acme", 
    primary: "#3B82F6", 
    secondary: "#60A5FA",
    bg: "bg-blue-50",
  },
  { 
    name: "TechCo", 
    primary: "#9AE83E", 
    secondary: "#6DB827",
    bg: "bg-[#9AE83E]/10",
  },
  { 
    name: "Nova", 
    primary: "#8B5CF6", 
    secondary: "#A78BFA",
    bg: "bg-purple-50",
  },
];

export function BrandProfilesScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { shouldAnimate } = useBentoMotionGate(ref);
  const activeBrandIndex = useCycleState([0, 1, 2], 2000, shouldAnimate);
  const activeBrand = brands[activeBrandIndex];

  return (
    <SceneContainer
      background={<SceneBackgroundGrid />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="success">
            <Palette className="w-3 h-3" />
            Tokens synced
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div ref={ref} className="w-full h-full flex flex-col gap-2 px-1">
        {/* Brand tabs */}
        <div className="flex gap-1 justify-center">
          {brands.map((brand, i) => (
            <motion.button
              key={brand.name}
              className={`px-2 py-1 rounded text-[9px] font-medium transition-all ${
                i === activeBrandIndex 
                  ? "text-white shadow-md" 
                  : "bg-gray-100 text-gray-500"
              }`}
              style={{ 
                backgroundColor: i === activeBrandIndex ? brand.primary : undefined 
              }}
              animate={{ scale: i === activeBrandIndex ? 1.05 : 1 }}
            >
              {brand.name}
            </motion.button>
          ))}
        </div>

        {/* Mini UI preview */}
        <WindowFrame variant="browser" className="flex-1">
          <motion.div
            className={`w-full h-full ${activeBrand.bg} transition-colors duration-300`}
            key={activeBrandIndex}
          >
            {/* Mini landing page */}
            <div className="p-2 flex flex-col gap-1.5 h-full">
              {/* Header */}
              <div className="flex items-center justify-between">
                <motion.div
                  className="w-8 h-2 rounded"
                  style={{ backgroundColor: activeBrand.primary }}
                  layoutId="logo"
                />
                <div className="flex gap-1">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-4 h-1 bg-gray-300 rounded" />
                  ))}
                </div>
              </div>

              {/* Hero */}
              <div className="flex-1 flex flex-col items-center justify-center gap-1">
                <div className="w-16 h-1.5 bg-gray-800 rounded" />
                <div className="w-12 h-1 bg-gray-400 rounded" />
                <motion.div
                  className="w-10 h-3 rounded mt-1 flex items-center justify-center"
                  style={{ backgroundColor: activeBrand.primary }}
                  whileHover={{ scale: 1.05 }}
                >
                  <span className="text-[6px] text-white font-medium">CTA</span>
                </motion.div>
              </div>

              {/* Cards */}
              <div className="flex gap-1">
                {[1, 2, 3].map(i => (
                  <motion.div
                    key={i}
                    className="flex-1 h-8 rounded border bg-white flex flex-col items-center justify-center gap-0.5"
                    style={{ borderColor: activeBrand.secondary }}
                  >
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: activeBrand.primary }}
                    />
                    <div className="w-4 h-0.5 bg-gray-300 rounded" />
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </WindowFrame>

        {/* Token preview */}
        <div className="flex items-center justify-center gap-2">
          <div className="flex items-center gap-1">
            <motion.div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: activeBrand.primary }}
              layoutId="primary"
            />
            <span className="text-[8px] text-gray-500">Primary</span>
          </div>
          <div className="flex items-center gap-1">
            <motion.div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: activeBrand.secondary }}
              layoutId="secondary"
            />
            <span className="text-[8px] text-gray-500">Secondary</span>
          </div>
        </div>
      </div>
    </SceneContainer>
  );
}

