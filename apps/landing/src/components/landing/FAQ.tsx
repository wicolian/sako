"use client";

import { useState } from "react";
import { faqItems, faqCopy } from "@/config/landing";
import { ChevronDown } from "lucide-react";
import { patterns } from "@/lib/design-tokens";

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      className="py-24 px-6 min-h-screen flex items-center justify-center bg-gray-50"
      id="faq"
    >
      <div className="mx-auto max-w-[800px] w-full">
        <div className="text-center mb-16">
          <h2 className={`${patterns.heading2} mb-4`}>
            {faqCopy.title.start}
            <span className="font-serif italic text-serif-accent text-serif-italic">
              {faqCopy.title.italic}
            </span>
            {faqCopy.title.end}
          </h2>
        </div>

        <div className="space-y-3">
          {faqItems.map((item, index) => (
            <div
              key={item.id}
              className={`bg-white border rounded-2xl overflow-hidden transition-all duration-300 ${
                openIndex === index ? 'border-[#1a1a1a] shadow-lg' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-6 text-left"
              >
                <span className="font-medium text-black pr-4">{item.question}</span>
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-300 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div
                className={`grid transition-all duration-300 ${
                  openIndex === index ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="px-6 pb-6 text-sm text-gray-700 leading-relaxed">
                    {item.answer}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
