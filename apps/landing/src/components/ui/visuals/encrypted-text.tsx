"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface EncryptedTextProps {
  text: string;
  className?: string;
  revealDelayMs?: number;
  charset?: string;
  flipDelayMs?: number;
  encryptedClassName?: string;
  revealedClassName?: string;
}

export function EncryptedText({
  text,
  className,
  revealDelayMs = 150, // Slower reveal - each character takes 150ms
  charset = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$%&@#!?",
  flipDelayMs = 40, // Fast flipping for scramble effect
  encryptedClassName,
  revealedClassName,
}: EncryptedTextProps) {
  const [revealedChars, setRevealedChars] = useState(0);
  const [displayChars, setDisplayChars] = useState<string[]>(() =>
    text.split("").map(() => "_") // Start with consistent underscores for SSR
  );
  const [isMounted, setIsMounted] = useState(false);

  // Only start randomization after component mounts on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initialize scrambling only after mount to avoid hydration mismatch
  useEffect(() => {
    if (isMounted) {
      setDisplayChars(
        text.split("").map(() => charset[Math.floor(Math.random() * charset.length)])
      );
    }
  }, [isMounted, text, charset]);

  // Reveal characters one by one with delay
  useEffect(() => {
    if (!isMounted) return;

    const chars = text.split("");
    let currentIndex = 0;

    // Start revealing after a small initial delay
    const startDelay = setTimeout(() => {
      const interval = setInterval(() => {
        currentIndex++;
        if (currentIndex > chars.length) {
          clearInterval(interval);
          return;
        }
        setRevealedChars(currentIndex);
      }, revealDelayMs);

      return () => clearInterval(interval);
    }, 300);

    return () => clearTimeout(startDelay);
  }, [isMounted, text, revealDelayMs]);

  // Continuously scramble unrevealed characters
  useEffect(() => {
    if (!isMounted) return;

    const chars = text.split("");
    const interval = setInterval(() => {
      setDisplayChars(
        chars.map((char, index) => {
          if (index < revealedChars) {
            return char;
          }
          // Random scramble with weighted probability for numbers/symbols
          return charset[Math.floor(Math.random() * charset.length)];
        })
      );
    }, flipDelayMs);

    return () => clearInterval(interval);
  }, [isMounted, text, revealedChars, charset, flipDelayMs]);

  return (
    <span className={cn("inline-block font-mono", className)}>
      {displayChars.map((char, index) => (
        <motion.span
          key={`${index}-${revealedChars}`}
          initial={{ opacity: 0.7, scale: 0.95 }}
          animate={{
            opacity: index < revealedChars ? 1 : 0.6,
            scale: 1,
          }}
          transition={{ duration: 0.1 }}
          className={cn(
            "inline-block",
            index < revealedChars
              ? revealedClassName || "text-current"
              : encryptedClassName || "text-gray-400"
          )}
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
}

