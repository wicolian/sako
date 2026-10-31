"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface FloatingBlogCTAProps {
    appUrl?: string;
}

export function FloatingBlogCTA({ appUrl = "https://app.trysako.com" }: FloatingBlogCTAProps) {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 200);
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <div className="sticky top-28 space-y-3">
            {/* Main CTA card */}
            <div className={[
                "rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-500",
                scrolled ? "opacity-100" : "opacity-0",
            ].join(" ")}>
                <div className="w-8 h-8 rounded-lg bg-[#9AE83E]/15 flex items-center justify-center mb-4">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3a7a0c" strokeWidth="1.75">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                </div>

                <p className="text-sm font-semibold text-black mb-1 leading-snug">
                    Ship design that converts
                </p>
                <p className="text-xs text-gray-500 leading-relaxed mb-5">
                    GTM-ready assets in 48h. Month-to-month, no contracts.
                </p>

                <Link
                    href={appUrl}
                    className="block w-full text-center px-4 py-2.5 bg-[#1a1a1a] text-white text-xs font-semibold rounded-full hover:bg-gray-800 transition-colors mb-2.5"
                >
                    Start Shipping →
                </Link>
                <Link
                    href="/book-a-call"
                    className="block w-full text-center px-4 py-2.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-full hover:border-gray-400 transition-colors"
                >
                    Book a fit check
                </Link>

                <p className="text-[10px] text-gray-400 text-center mt-3">
                    14-day money-back guarantee
                </p>
            </div>

            {/* Quick links */}
            <div className={[
                "rounded-2xl border border-gray-200 bg-white p-5 transition-all duration-500 delay-100",
                scrolled ? "opacity-100" : "opacity-0",
            ].join(" ")}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                    Quick links
                </p>
                <div className="space-y-2">
                    {[
                        { href: "/pricing", label: "See pricing" },
                        { href: "/roi-calculator", label: "Calculate your ROI" },
                        { href: "/compare/agencies", label: "Sako vs agencies" },
                        { href: "/how-it-works", label: "How it works" },
                    ].map(({ href, label }) => (
                        <Link
                            key={href}
                            href={href}
                            className="flex items-center gap-2 text-xs text-gray-500 hover:text-black transition-colors py-0.5"
                        >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
