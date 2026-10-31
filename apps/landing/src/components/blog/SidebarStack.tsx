"use client";

import Link from "next/link";
import { AuthorCard } from "./AuthorCard";
import { ShareButtons } from "./ShareButtons";

interface SidebarStackProps {
    shareUrl: string;
    shareTitle: string;
    appUrl?: string;
}

export function SidebarStack({
    shareUrl,
    shareTitle,
    appUrl = "https://app.trysako.com",
}: SidebarStackProps) {
    return (
        <div className="space-y-6">
            {/* Author */}
            <AuthorCard />

            <div className="h-px bg-gray-100 w-full" />

            {/* Share */}
            <ShareButtons url={shareUrl} title={shareTitle} />

            <div className="h-px bg-gray-100 w-full" />

            {/* CTA Card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-[#9AE83E]/15 flex items-center justify-center mb-3">
                    <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#3a7a0c"
                        strokeWidth="1.75"
                    >
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                </div>

                <p className="text-sm font-semibold text-gray-900 mb-1 leading-snug">
                    Ship design that converts
                </p>
                <p className="text-xs text-gray-500 leading-relaxed mb-4">
                    GTM-ready assets in 48h. Month-to-month, no contracts.
                </p>

                <Link
                    href={appUrl}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#9AE83E] text-black text-xs font-bold rounded-full hover:bg-[#8ad932] transition-colors mb-2"
                >
                    Start Shipping
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                    >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                </Link>
                <Link
                    href="/book-a-call"
                    className="flex items-center justify-center w-full px-4 py-2.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-full hover:border-gray-400 transition-colors"
                >
                    Book a fit check
                </Link>

                <p className="text-[10px] text-gray-400 text-center mt-3">
                    14-day money-back guarantee
                </p>
            </div>

            {/* Quick links */}
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                    Quick links
                </p>
                <div className="space-y-1.5">
                    {[
                        { href: "/pricing", label: "See pricing" },
                        { href: "/roi-calculator", label: "Calculate your ROI" },
                        { href: "/compare/agencies", label: "Sako vs agencies" },
                        { href: "/how-it-works", label: "How it works" },
                    ].map(({ href, label }) => (
                        <Link
                            key={href}
                            href={href}
                            className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-900 transition-colors py-0.5"
                        >
                            <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                            {label}
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
