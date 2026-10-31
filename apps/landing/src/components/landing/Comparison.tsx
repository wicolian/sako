"use client";

import { comparisonLabels, comparisonData, comparisonCopy } from "@/config/landing";
import Link from "next/link";

export function Comparison() {
  return (
    <section
      className="py-24 px-6 bg-white min-h-screen flex items-center justify-center border-b border-gray-100"
      id="comparison"
    >
      <div className="max-w-[1200px] w-full mx-auto">
        <div className="text-center mb-16">
          <h2 className="md:text-4xl text-3xl font-medium text-black tracking-tight mb-4">
            <span className="text-serif-italic text-serif-accent font-medium italic text-brand-serif-accent">
              {comparisonCopy.title.italic}
            </span>
            {comparisonCopy.title.end}
          </h2>
          <p className="text-gray-500">{comparisonCopy.subtitle}</p>
        </div>

        <div className="overflow-x-auto pb-6 -mx-6 px-6 md:mx-0 md:px-0 scroll-smooth">
          <table className="w-full min-w-[800px] text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="sticky left-0 z-20 bg-white py-6 px-4 font-medium text-gray-400 uppercase tracking-wider text-xs border-r border-gray-100/50 shadow-[4px_0_16px_-4px_rgba(0,0,0,0.05)] md:shadow-none md:border-r-0">
                  Criteria
                </th>
                <th className="py-6 px-4 font-bold text-black bg-[#9AE83E]/10 border-t border-x border-[#9AE83E]/20 rounded-t-xl w-1/4">
                  {comparisonData.sako.name}
                </th>
                <th className="py-6 px-4 font-medium text-gray-500 w-1/5">
                  {comparisonData.inhouse.name}
                </th>
                <th className="py-6 px-4 font-medium text-gray-500 w-1/5">
                  {comparisonData.freelancers.name}
                </th>
                <th className="py-6 px-4 font-medium text-gray-500 w-1/5">
                  {comparisonData.agencies.name}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {comparisonLabels.map((label, rowIndex) => (
                <tr key={rowIndex}>
                  <td className="sticky left-0 z-10 bg-white py-5 px-4 font-medium text-black border-r border-gray-100/50 shadow-[4px_0_16px_-4px_rgba(0,0,0,0.05)] md:shadow-none md:border-r-0">
                    {label}
                  </td>
                  {/* Sako */}
                  <td className="py-5 px-4 bg-[#9AE83E]/5 border-x border-[#9AE83E]/10 font-bold text-[#0A0A0A]">
                    {comparisonData.sako.items[rowIndex].check ? (
                      <div className="flex items-center gap-2">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="text-[#0A0A0A]"
                        >
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        {comparisonData.sako.items[rowIndex].text}
                      </div>
                    ) : (
                      comparisonData.sako.items[rowIndex].text
                    )}
                  </td>
                  {/* In-house */}
                  <td className="py-5 px-4 text-gray-500">
                    {comparisonData.inhouse.items[rowIndex].text}
                  </td>
                  {/* Freelancers */}
                  <td className="py-5 px-4 text-gray-500">
                    {comparisonData.freelancers.items[rowIndex].text}
                  </td>
                  {/* Agencies */}
                  <td className="py-5 px-4 text-gray-500">
                    {comparisonData.agencies.items[rowIndex].text}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-center gap-4 mt-12">
          <Link
            href={comparisonCopy.buttons.primary.href}
            className="px-8 py-3 bg-[#1a1a1a] text-white text-sm font-bold uppercase tracking-tight rounded-full hover:bg-gray-800 transition-all shadow-lg shadow-[#1a1a1a]/10"
          >
            {comparisonCopy.buttons.primary.label}
          </Link>
          <Link
            href={comparisonCopy.buttons.secondary.href}
            className="px-8 py-3 text-sm font-semibold text-gray-600 border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-all"
          >
            {comparisonCopy.buttons.secondary.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
