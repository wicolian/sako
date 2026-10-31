"use client";

import { isSakoForYouCopy } from "@/config/landing";
import Link from "next/link";
import { patterns } from "@/lib/design-tokens";
import { FlipWords } from "@/components/ui/animations/flip-words";

// Benefit words that rotate
const benefitWords = ["faster", "better", "smarter", "cheaper"];

export function WhySako() {
  return (
    <section
      className="py-24 px-6 relative min-h-screen flex items-center justify-center bg-gray-50 border-gray-300 border-b"
      id="why"
    >
      <div className="w-full max-w-[1200px] mr-auto ml-auto">
        <div className="text-center mb-16">
          <h2 className={`${patterns.heading2} mb-4`}>
            {isSakoForYouCopy.title.start}
            <span className="text-serif-italic text-serif-accent font-medium italic text-brand-serif-accent">
              {isSakoForYouCopy.title.italic}
            </span>
            {isSakoForYouCopy.title.end}
          </h2>
          <p className="text-gray-700">
            Ship creative <FlipWords words={benefitWords} className="font-semibold text-gray-400" /> with Sako.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-stretch">
          {/* For You */}
          <div className="p-10 rounded-[2rem] bg-white border border-gray-200 shadow-xl shadow-[#9AE83E]/5 flex flex-col">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-[#9AE83E] rounded-full flex items-center justify-center text-black">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <h3 className="text-xl font-semibold">
                {isSakoForYouCopy.forYou.title}
              </h3>
            </div>
            <ul className="space-y-6 flex-1">
              {isSakoForYouCopy.forYou.items.map((item, index) => (
                <li key={index} className="flex gap-4">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-[#9AE83E] shrink-0"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="m9 12 2 2 4-4"></path>
                  </svg>
                  <span className="text-gray-600">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Not For You */}
          <div className="p-10 rounded-[2rem] bg-gray-100/50 border border-gray-200/50 flex flex-col">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18"></path>
                  <path d="M6 6l12 12"></path>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-700">
                {isSakoForYouCopy.notForYou.title}
              </h3>
            </div>
            <ul className="space-y-6 flex-1">
              {isSakoForYouCopy.notForYou.items.map((item, index) => (
                <li key={index} className="flex gap-4">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-gray-400 shrink-0"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="m15 9-6 6"></path>
                    <path d="m9 9 6 6"></path>
                  </svg>
                  <span className="text-gray-500">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-12 text-center">
          <Link
            href={isSakoForYouCopy.cta.href}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#1a1a1a] text-white text-sm font-bold uppercase tracking-tight rounded-full hover:bg-gray-800 transition-all shadow-lg shadow-[#1a1a1a]/10"
          >
            {isSakoForYouCopy.cta.label}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14M12 5l7 7-7 7"></path>
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
