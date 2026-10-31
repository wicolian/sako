"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { useBentoMotionGate, useCycleState } from "../use-bento-motion";
import { SceneContainer, SceneBackgroundDots, WindowFrame, OverlayContainer, StatusChip } from "../scene-layers";
import { Layout, Monitor, Tablet, Smartphone } from "lucide-react";

/**
 * Scene: Figma Landing Page
 * Shows Figma-like frame with sections snapping in, responsive toggles
 */

const devices = [
  { icon: Monitor, label: "Desktop", width: "100%" },
  { icon: Tablet, label: "Tablet", width: "75%" },
  { icon: Smartphone, label: "Mobile", width: "40%" },
];

const sections = [
  { name: "Hero", height: 32, color: "bg-[#9AE83E]/20" },
  { name: "Features", height: 24, color: "bg-blue-100" },
  { name: "Proof", height: 20, color: "bg-purple-100" },
  { name: "CTA", height: 16, color: "bg-amber-100" },
];

export function FigmaLandingPageScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { shouldAnimate } = useBentoMotionGate(ref);
  const activeDevice = useCycleState([0, 1, 2], 2500, shouldAnimate);
  const device = devices[activeDevice];
  const DeviceIcon = device.icon;

  return (
    <SceneContainer
      background={<SceneBackgroundDots />}
      overlay={
        <OverlayContainer position="top-right">
          <StatusChip variant="success">
            <Layout className="w-3 h-3" />
            Responsive
          </StatusChip>
        </OverlayContainer>
      }
    >
      <div ref={ref} className="w-full h-full flex flex-col gap-2">
        {/* Device toggle */}
        <div className="flex justify-center gap-1">
          {devices.map((d, i) => {
            const Icon = d.icon;
            const isActive = i === activeDevice;
            return (
              <motion.div
                key={d.label}
                className={`p-1.5 rounded ${isActive ? "bg-[#1a1a1a] text-white" : "bg-gray-100 text-gray-400"}`}
                animate={{ scale: isActive ? 1.1 : 1 }}
                transition={{ duration: 0.2 }}
              >
                <Icon className="w-3 h-3" />
              </motion.div>
            );
          })}
        </div>

        {/* Figma frame */}
        <WindowFrame variant="figma" className="flex-1">
          <div className="p-2 h-full flex justify-center">
            <motion.div
              className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden flex flex-col"
              animate={{ width: device.width }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              style={{ maxWidth: "100%", minWidth: 60 }}
            >
              {sections.map((section, i) => (
                <motion.div
                  key={section.name}
                  className={`${section.color} border-b border-gray-100 flex items-center justify-center relative overflow-hidden`}
                  style={{ height: section.height }}
                  initial={{ opacity: 0, y: -10 }}
                  animate={shouldAnimate ? { 
                    opacity: 1, 
                    y: 0,
                  } : { opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.15, duration: 0.3 }}
                >
                  {/* Section content skeleton */}
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="w-8 h-1 bg-gray-300/50 rounded-full" />
                    <div className="w-12 h-0.5 bg-gray-300/30 rounded-full" />
                  </div>
                  
                  {/* Section label */}
                  <span className="absolute left-1 top-0.5 text-[6px] font-mono text-gray-400">
                    {section.name}
                  </span>
                  
                  {/* Snap-in animation */}
                  {shouldAnimate && (
                    <motion.div
                      className="absolute inset-0 border-2 border-[#9AE83E]"
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 0 }}
                      transition={{ delay: i * 0.15 + 0.1, duration: 0.3 }}
                    />
                  )}
                </motion.div>
              ))}
            </motion.div>
          </div>
        </WindowFrame>

        {/* Device label */}
        <motion.div 
          className="text-center"
          key={device.label}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className="text-[9px] font-medium text-gray-500 flex items-center justify-center gap-1">
            <DeviceIcon className="w-3 h-3" />
            {device.label}
          </span>
        </motion.div>
      </div>
    </SceneContainer>
  );
}

