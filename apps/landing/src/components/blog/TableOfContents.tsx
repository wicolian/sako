"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { ToCItem } from "@/lib/blog-helpers";

interface TableOfContentsProps {
    items: ToCItem[];
}

/* ── Desktop Table of Contents ── */
export function TableOfContents({ items }: TableOfContentsProps) {
    const [activeId, setActiveId] = useState<string>("");
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        setPrefersReducedMotion(mq.matches);
        const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    useEffect(() => {
        if (!items.length) return;

        const ids = items.map((it) => it.id);
        const headings = ids
            .map((id) => document.getElementById(id))
            .filter(Boolean) as HTMLElement[];

        if (!headings.length) return;

        const observer = new IntersectionObserver(
            (entries) => {
                // Find the first heading that's currently intersecting
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible.length > 0) {
                    setActiveId(visible[0].target.id);
                }
            },
            { rootMargin: "-96px 0px -60% 0px", threshold: 0 }
        );

        headings.forEach((h) => observer.observe(h));
        return () => observer.disconnect();
    }, [items]);

    const scrollTo = useCallback(
        (id: string) => {
            const el = document.getElementById(id);
            if (el) {
                const top = el.getBoundingClientRect().top + window.scrollY - 128;
                window.scrollTo({
                    top,
                    behavior: prefersReducedMotion ? "auto" : "smooth",
                });
            }
        },
        [prefersReducedMotion]
    );

    if (!items.length) return null;

    return (
        <nav aria-label="Table of contents">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
                On this page
            </p>
            <ul className="space-y-0.5">
                {items.map((item) => {
                    const isActive = activeId === item.id;
                    return (
                        <li
                            key={item.id}
                            style={{
                                paddingLeft:
                                    item.level === 3
                                        ? "0.875rem"
                                        : item.level === 4
                                            ? "1.5rem"
                                            : "0",
                            }}
                        >
                            <a
                                href={`#${item.id}`}
                                aria-current={isActive ? "true" : undefined}
                                onClick={(e) => {
                                    e.preventDefault();
                                    scrollTo(item.id);
                                }}
                                className={[
                                    "block text-[13px] leading-snug py-1.5 pr-2 transition-all duration-150 border-l-2",
                                    isActive
                                        ? "border-[#9AE83E] pl-3 text-gray-900 font-semibold"
                                        : "border-transparent pl-3 text-gray-400 hover:text-gray-700 hover:border-gray-300",
                                ].join(" ")}
                            >
                                {item.text}
                            </a>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

/* ── Mobile TOC Accordion ── */
export function MobileTOC({ items }: TableOfContentsProps) {
    const [open, setOpen] = useState(false);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        setPrefersReducedMotion(mq.matches);
        const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    const scrollTo = useCallback(
        (id: string) => {
            const el = document.getElementById(id);
            if (el) {
                const top = el.getBoundingClientRect().top + window.scrollY - 128;
                window.scrollTo({
                    top,
                    behavior: prefersReducedMotion ? "auto" : "smooth",
                });
                setOpen(false);
            }
        },
        [prefersReducedMotion]
    );

    if (!items.length) return null;

    return (
        <div className="lg:hidden mb-8">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                aria-expanded={open}
            >
                <span className="flex items-center gap-2">
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-gray-400"
                    >
                        <path d="M4 6h16M4 12h16M4 18h10" />
                    </svg>
                    On this page
                </span>
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""
                        }`}
                >
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>
            {open && (
                <div className="mt-2 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200">
                    <ul className="space-y-1">
                        {items.map((item) => (
                            <li
                                key={item.id}
                                style={{
                                    paddingLeft:
                                        item.level === 3
                                            ? "0.75rem"
                                            : item.level === 4
                                                ? "1.25rem"
                                                : "0",
                                }}
                            >
                                <a
                                    href={`#${item.id}`}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        scrollTo(item.id);
                                    }}
                                    className="block text-sm py-1.5 text-gray-600 hover:text-gray-900 transition-colors"
                                >
                                    {item.text}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
