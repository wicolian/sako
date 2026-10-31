"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { NewsletterForm } from "@/components/blocks/NewsletterForm";

interface Post {
    _id: string;
    title: string;
    slug: { current: string };
    publishedAt: string;
    category?: string;
    excerpt?: string;
    imageUrl?: string;
}

const PAGE_SIZE = 12;

function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });
}

function readTime(excerpt?: string) {
    const words = (excerpt ?? "").split(/\s+/).length;
    return Math.max(3, Math.ceil(words / 200));
}

const CATEGORY_COLORS: Record<string, string> = {
    "ROI & Revenue": "text-green-700 bg-green-50 ring-green-600/20",
    "Agency Comparison": "text-blue-700 bg-blue-50 ring-blue-600/20",
    "Design Ops": "text-indigo-700 bg-indigo-50 ring-indigo-600/20",
    Process: "text-violet-700 bg-violet-50 ring-violet-600/20",
    Growth: "text-emerald-700 bg-emerald-50 ring-emerald-600/20",
    Motion: "text-pink-700 bg-pink-50 ring-pink-600/20",
    "B2B Marketing": "text-orange-700 bg-orange-50 ring-orange-600/20",
    Informational: "text-gray-600 bg-gray-50 ring-gray-500/10",
};

function CategoryBadge({ cat }: { cat?: string }) {
    const label = cat ?? "Article";
    const color = CATEGORY_COLORS[label] ?? CATEGORY_COLORS["Informational"];
    return (
        <span
            className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${color}`}
        >
            {label}
        </span>
    );
}

export function BlogListClient({ posts }: { posts: Post[] }) {
    const categories = useMemo(() => {
        const all = posts.map((p) => p.category ?? "Article");
        return ["All", ...Array.from(new Set(all))];
    }, [posts]);

    const [activeCategory, setActiveCategory] = useState("All");
    const [shown, setShown] = useState(PAGE_SIZE);

    const filtered = useMemo(() => {
        return posts.filter((p) => {
            return activeCategory === "All" || p.category === activeCategory;
        });
    }, [posts, activeCategory]);

    const featured = filtered[0];
    const rest = filtered.slice(1, shown);
    const hasMore = shown < filtered.length;

    return (
        <div className="bg-white min-h-screen">
            {/* ── HEADER ── */}
            <div className="bg-[#0A0A0A] px-6 py-24 sm:py-32 lg:px-8 border-b border-white/10">
                <div className="mx-auto max-w-7xl text-center">
                    <p className="inline-flex items-center gap-2 rounded-full bg-[#9AE83E]/10 px-3 py-1 text-sm font-semibold uppercase tracking-wide text-[#9AE83E] ring-1 ring-inset ring-[#9AE83E]/20 mb-8">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#9AE83E] animate-pulse" />
                        Sako Journal
                    </p>
                    <h1 className="mt-2 text-5xl font-bold tracking-tight text-white sm:text-7xl">
                        Design that{" "}
                        <span className="font-serif italic text-[#9AE83E]">earns</span> its keep.
                    </h1>
                    <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-400 mb-10">
                        Field notes on design operations, ROI-driven creative, and
                        go-to-market execution for B2B SaaS teams.
                    </p>
                    <div className="mx-auto max-w-lg">
                        <NewsletterForm
                            variant="dark"
                            heading=""
                            description=""
                            ctaLabel="Get the newsletter →"
                            socialProof="Design ops field notes, delivered weekly. No spam."
                        />
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12 sm:py-20">
                {/* ── CATEGORY FILTER ── */}
                <div className="flex flex-wrap items-center justify-center gap-3 mb-16">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => {
                                setActiveCategory(cat);
                                setShown(PAGE_SIZE);
                            }}
                            className={`rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 ${cat === activeCategory
                                ? "bg-[#0A0A0A] text-white shadow-sm"
                                : "bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-gray-200"
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {filtered.length === 0 ? (
                    <div className="text-center py-20 text-gray-500 text-lg">
                        No articles found in this category.
                    </div>
                ) : (
                    <div>
                        {/* ── FEATURED POST ── */}
                        {featured && activeCategory === "All" && (
                            <article className="relative group mb-20">
                                <div className="rounded-2xl border border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:shadow-sm transition-all duration-300 overflow-hidden">
                                    <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
                                        <div className="lg:w-1/2 aspect-[40/21] lg:aspect-auto relative overflow-hidden bg-gray-200">
                                            <img
                                                src={featured.imageUrl || `/blog/${featured.slug.current}/opengraph-image`}
                                                alt={featured.title}
                                                className="absolute inset-0 w-full h-full object-cover opacity-95 hover:opacity-100 hover:scale-105 transition-all duration-500"
                                            />
                                        </div>
                                        <div className="flex-1 p-8 lg:p-12 self-center">
                                            <div className="flex items-center gap-x-4 text-xs mb-6">
                                                <time
                                                    dateTime={featured.publishedAt}
                                                    className="text-gray-500"
                                                >
                                                    {formatDate(featured.publishedAt)}
                                                </time>
                                                <CategoryBadge cat={featured.category} />
                                                <span className="text-gray-400 ml-auto text-xs">
                                                    {readTime(featured.excerpt)} min read
                                                </span>
                                            </div>

                                            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 leading-[1.2] mb-4 group-hover:text-gray-700 transition-colors">
                                                <Link href={`/blog/${featured.slug.current}`}>
                                                    <span className="absolute inset-0" />
                                                    {featured.title}
                                                </Link>
                                            </h3>

                                            {featured.excerpt && (
                                                <p className="text-lg leading-relaxed text-gray-600 line-clamp-3 mb-6">
                                                    {featured.excerpt}
                                                </p>
                                            )}

                                            <div className="flex items-center gap-x-2 text-sm font-semibold leading-6 text-gray-900 group-hover:text-[#15803d] transition-colors">
                                                Read featured article{" "}
                                                <span
                                                    aria-hidden="true"
                                                    className="group-hover:translate-x-1 transition-transform"
                                                >
                                                    &rarr;
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </article>
                        )}

                        {/* ── GRID ── */}
                        <div
                            className={`grid max-w-2xl grid-cols-1 gap-x-8 gap-y-12 lg:mx-0 lg:max-w-none lg:grid-cols-3 ${activeCategory !== "All" || !featured
                                ? "mt-0"
                                : "border-t border-gray-100 pt-16 sm:pt-20"
                                }`}
                        >
                            {rest.map((post) => (
                                <article
                                    key={post._id}
                                    className="flex flex-col items-start justify-between group rounded-3xl overflow-hidden hover:bg-gray-50/70 transition-colors duration-200 border border-gray-100 hover:border-gray-200 hover:shadow-sm bg-white"
                                >
                                    <div className="w-full aspect-[40/21] bg-gray-200 overflow-hidden">
                                        <img
                                            src={post.imageUrl || `/blog/${post.slug.current}/opengraph-image`}
                                            alt={post.title}
                                            className="w-full h-full object-cover opacity-95 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                                        />
                                    </div>
                                    <div className="p-6 sm:p-8 flex-1 flex flex-col w-full">
                                        <div className="flex items-center gap-x-4 text-xs w-full mb-4">
                                            <time
                                                dateTime={post.publishedAt}
                                                className="text-gray-500"
                                            >
                                                {formatDate(post.publishedAt)}
                                            </time>
                                            <CategoryBadge cat={post.category} />
                                        </div>

                                        <div className="group relative">
                                            <h3 className="text-lg font-bold leading-snug text-gray-900 group-hover:text-gray-700 transition-colors mb-3">
                                                <Link href={`/blog/${post.slug.current}`}>
                                                    <span className="absolute inset-0" />
                                                    {post.title}
                                                </Link>
                                            </h3>
                                            {post.excerpt && (
                                                <p className="line-clamp-3 text-[15px] leading-relaxed text-gray-500">
                                                    {post.excerpt}
                                                </p>
                                            )}
                                        </div>

                                        <div className="mt-8 flex items-center gap-x-2 text-sm font-medium leading-6 text-gray-900 pt-4 w-full border-t border-gray-100">
                                            Read article{" "}
                                            <span
                                                className="group-hover:translate-x-1 transition-transform"
                                                aria-hidden="true"
                                            >
                                                &rarr;
                                            </span>
                                            <span className="text-gray-400 ml-auto text-xs">
                                                {readTime(post.excerpt)} min read
                                            </span>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>

                        {/* ── LOAD MORE ── */}
                        {hasMore && (
                            <div className="mt-20 flex justify-center">
                                <button
                                    onClick={() => setShown((s) => s + PAGE_SIZE)}
                                    className="rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
                                >
                                    Load {Math.min(PAGE_SIZE, filtered.length - shown)} more
                                    articles
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
