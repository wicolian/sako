"use client";

import { pricingPlans, pricingCopy } from "@/config/landing";
import Link from "next/link";
import { tokens, patterns } from "@/lib/design-tokens";

export function Pricing() {
  return (
    <section
      className="py-24 px-6 relative bg-white min-h-screen flex items-center justify-center"
      id="pricing"
    >
      <div className="mx-auto max-w-[1200px] w-full">
        <h2 className={`${patterns.heading2} text-center mb-4`}>
          <span className="text-serif-italic text-serif-accent font-medium italic text-brand-serif-accent">
            {pricingCopy.title.italic}
          </span>
          {pricingCopy.title.end}
        </h2>
        <p className="text-center text-gray-700 mb-8 max-w-xl mx-auto">
          {pricingCopy.subtitle}
        </p>

        {/* Micro Banner */}
        <div className="max-w-3xl mx-auto mb-16 text-center">
          <div className="inline-block bg-[#1a1a1a]/5 rounded-lg px-4 py-2 border border-[#1a1a1a]/10">
            <p className="text-xs font-medium text-gray-700">
              <span className="text-[#0A0A0A] font-bold">
                {pricingCopy.offer.label}
              </span>
              {pricingCopy.offer.text}
              <br className="sm:hidden" />
              Or start with{" "}
              <Link
                href={pricingCopy.offer.linkHref}
                className="underline decoration-[#9AE83E] decoration-2"
              >
                {pricingCopy.offer.linkText}
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 gap-x-8 gap-y-8 items-start">
          {pricingPlans.map((plan) => (
            <div
              key={plan.id}
              className={
                plan.highlighted
                  ? "bg-[#1a1a1a] text-white rounded-3xl p-8 border border-[#1a1a1a] shadow-2xl relative overflow-hidden transform lg:-translate-y-4"
                  : "bg-white rounded-3xl p-8 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
              }
            >
              {plan.highlighted && (
                <div className="absolute top-0 right-0 p-4">
                  <span className="bg-[#9AE83E] text-black text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                    {plan.badge}
                  </span>
                </div>
              )}
              <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold tracking-tight">
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-gray-400 text-sm">{plan.period}</span>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-6">{plan.description}</p>
              <div
                className={`h-px mb-6 ${
                  plan.highlighted ? "bg-white/10" : "bg-gray-100"
                }`}
              ></div>
              <ul className="space-y-4 text-sm mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex gap-3 items-start">
                    <svg
                      className={`w-5 h-5 shrink-0 ${
                        plan.highlighted ? "text-[#9AE83E]" : "text-black"
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M20 6 9 17l-5-5"></path>
                    </svg>
                    <span
                      className={
                        plan.highlighted ? "text-gray-300" : "text-gray-600"
                      }
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
              {plan.highlighted ? (
                <Link
                  href={plan.ctaHref}
                  className="block w-full py-3 rounded-full bg-[#9AE83E] text-black text-center text-sm font-bold uppercase tracking-tight hover:bg-white transition-colors"
                >
                  {plan.cta}
                </Link>
              ) : (
                <Link
                  href={plan.ctaHref}
                  className="block w-full py-3 rounded-full border border-gray-200 text-center text-sm font-bold uppercase tracking-tight hover:bg-[#1a1a1a] hover:text-white transition-colors"
                >
                  {plan.cta}
                </Link>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-12">
          {pricingCopy.footer}
        </p>
      </div>
    </section>
  );
}
