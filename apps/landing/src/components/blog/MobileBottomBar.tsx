"use client";

import Link from "next/link";
import { ShareButtons } from "./ShareButtons";

interface MobileBottomBarProps {
    shareUrl: string;
    shareTitle: string;
    appUrl?: string;
}

export function MobileBottomBar({
    shareUrl,
    shareTitle,
    appUrl = "https://app.trysako.com",
}: MobileBottomBarProps) {
    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
            <div className="bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
                <div className="flex items-center gap-3 max-w-lg mx-auto">
                    <Link
                        href={appUrl}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#9AE83E] text-black text-sm font-bold rounded-full hover:bg-[#8ad932] transition-colors"
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
                        className="flex items-center justify-center px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-full hover:border-gray-400 transition-colors whitespace-nowrap"
                    >
                        Book call
                    </Link>

                    <ShareButtons url={shareUrl} title={shareTitle} />
                </div>
            </div>
        </div>
    );
}
