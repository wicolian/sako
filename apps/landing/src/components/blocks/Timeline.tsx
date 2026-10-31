"use client";

import { useState, useEffect } from "react";
import { motion, PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/cards/card";
import { Badge } from "@/components/ui/layout/badge";
import { patterns } from "@/lib/design-tokens";

interface TimelineStep {
  number: string;
  title: string;
  description: string;
  badge?: string;
}

interface TimelineProps {
  eyebrow?: string;
  title?: string;
  layout?: 'vertical' | 'horizontal'; // kept for compatibility, carousel is always used
  steps: TimelineStep[];
}

// Parse {serif} markers in title for Playfair Display
function parseTitleWithSerif(title: string) {
  const parts = [];
  const regex = /\{([^}]+)\}/g;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(title)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: title.slice(lastIndex, match.index), serif: false });
    }
    parts.push({ text: match[1], serif: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < title.length) {
    parts.push({ text: title.slice(lastIndex), serif: false });
  }

  return parts.length > 0 ? parts : [{ text: title, serif: false }];
}

export function Timeline({ eyebrow, title, steps = [] }: TimelineProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardOffset, setCardOffset] = useState(320);

  const titleParts = title ? parseTitleWithSerif(title) : null;

  // Responsive card offset
  useEffect(() => {
    const updateDimensions = () => {
      setCardOffset(window.innerWidth < 640 ? 260 : 320);
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev === steps.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? steps.length - 1 : prev - 1));
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
    index: number
  ) => {
    const SWIPE_THRESHOLD = 50;
    if (info.offset.x > SWIPE_THRESHOLD && index === currentIndex) {
      prevSlide();
    } else if (info.offset.x < -SWIPE_THRESHOLD && index === currentIndex) {
      nextSlide();
    }
  };

  return (
    <section className={patterns.section}>
      <div className={patterns.container}>
        {/* Header */}
        {(eyebrow || title) && (
          <div className="text-center mb-8">
            {eyebrow && (
              <motion.div 
                className="mb-4 inline-block px-3 py-1 border border-gray-200 rounded-full bg-white"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  {eyebrow}
                </span>
              </motion.div>
            )}
            {title && (
              <motion.h2 
                className={`${patterns.heading2}`}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                {titleParts?.map((part, i) =>
                  part.serif ? (
                    <span key={i} className="font-serif italic text-brand-serif-accent">{part.text}</span>
                  ) : (
                    <span key={i}>{part.text}</span>
                  )
                )}
              </motion.h2>
            )}
          </div>
        )}

        {/* Carousel */}
        <div className="relative max-w-5xl mx-auto px-2 sm:px-0">
          {/* Navigation Arrows */}
          <button
            onClick={prevSlide}
            className="absolute left-0 sm:left-2 md:left-0 top-1/2 -translate-y-1/2 z-20 bg-white p-1.5 sm:p-2 md:p-3 rounded-full shadow-md hover:bg-[#9AE83E]/10 hover:border-[#9AE83E] border border-gray-200 transition-all duration-200"
            aria-label="Previous step"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-[#1a1a1a]" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-0 sm:right-2 md:right-0 top-1/2 -translate-y-1/2 z-20 bg-white p-1.5 sm:p-2 md:p-3 rounded-full shadow-md hover:bg-[#9AE83E]/10 hover:border-[#9AE83E] border border-gray-200 transition-all duration-200"
            aria-label="Next step"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-[#1a1a1a]" />
          </button>

          {/* Horizontal Timeline Line - Hidden on mobile */}
          <div className="hidden sm:block absolute left-12 right-12 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-[#9AE83E]/30 to-transparent z-0" />

          {/* Carousel Container */}
          <div className="relative overflow-hidden sm:overflow-visible touch-pan-x mx-8 sm:mx-12 md:mx-16 min-h-[280px] sm:min-h-[300px]">
            <div className="flex h-full items-start justify-center relative pt-8">
              {steps.map((step, index) => {
                const offset = (index - currentIndex) * cardOffset;
                return (
                  <motion.div
                    key={index}
                    className="absolute w-[calc(100%-2rem)] sm:w-72 md:w-80 max-w-[280px] sm:max-w-none"
                    initial={false}
                    animate={{
                      x: offset,
                      scale: index === currentIndex ? 1 : 0.9,
                      opacity: index === currentIndex ? 1 : 0.5,
                      zIndex: index === currentIndex ? 10 : 0,
                    }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    drag="x"
                    dragConstraints={{ left: -50, right: 50 }}
                    dragElastic={0.1}
                    onDragEnd={(e, info) => handleDragEnd(e, info, index)}
                  >
                    {/* Timeline Node */}
                    <div
                      className={`absolute left-1/2 top-[-0.5rem] w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full transform -translate-x-1/2 z-10 flex items-center justify-center font-mono text-[10px] sm:text-xs font-bold transition-all duration-300 ${
                        index === currentIndex
                          ? "bg-[#1a1a1a] text-white shadow-lg scale-110"
                          : "border-2 border-[#9AE83E]/50 bg-white text-gray-400"
                      }`}
                    >
                      {step.number}
                    </div>

                    {/* Card - Always shows full content */}
                    <div className="w-full pt-6 sm:pt-8">
                      <Card className={`border-gray-200 shadow-md transition-all duration-300 ${
                        index === currentIndex
                          ? "hover:shadow-xl"
                          : ""
                      }`}>
                        <CardContent className="p-4 sm:p-5 md:p-6">
                          <div className="flex flex-col items-center text-center">
                            {/* Badge */}
                            {step.badge && (
                              <Badge
                                variant="outline"
                                className="text-[9px] sm:text-[10px] py-0.5 sm:py-1 px-2 sm:px-3 bg-[#9AE83E]/10 border-[#9AE83E]/30 text-[#1a1a1a] font-mono uppercase tracking-wider mb-2 sm:mb-3"
                              >
                                {step.badge}
                              </Badge>
                            )}
                            
                            {/* Title */}
                            <h3 className="text-base sm:text-lg md:text-xl font-bold text-[#1a1a1a] mb-2 sm:mb-3 leading-tight">
                              {step.title}
                            </h3>
                            
                            {/* Description - Always visible */}
                            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                              {step.description}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Pagination Dots */}
          <div className="flex justify-center mt-6 gap-2">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                  index === currentIndex 
                    ? "bg-[#1a1a1a] scale-110" 
                    : "bg-gray-300 hover:bg-[#9AE83E]/50"
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
