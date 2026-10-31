import Link from "next/link";

interface RelatedPost {
    title: string;
    slug: { current: string };
    category?: string;
    excerpt?: string;
    imageUrl?: string;
}

interface RecommendedPostsProps {
    posts: RelatedPost[];
}

export function RecommendedPosts({ posts }: RecommendedPostsProps) {
    if (!posts.length) return null;

    return (
        <section className="mt-16 pt-12 border-t border-gray-200">
            <h2 className="text-xl font-semibold text-black mb-8">Keep reading</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.map((post) => (
                    <Link
                        key={post.slug.current}
                        href={`/blog/${post.slug.current}`}
                        className="group flex flex-col rounded-2xl border border-gray-200 bg-white hover:border-[#9AE83E] hover:shadow-sm transition-all duration-200 overflow-hidden"
                    >
                        <div className="w-full aspect-[16/9] bg-gray-200 overflow-hidden shrink-0 border-b border-gray-100">
                            <img
                                src={post.imageUrl || `/blog/${post.slug.current}/opengraph-image`}
                                alt={post.title}
                                className="w-full h-full object-cover mix-blend-multiply opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                            />
                        </div>
                        <div className="p-5 flex flex-col flex-1">
                            {post.category && (
                                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                                    {post.category}
                                </span>
                            )}
                            <p className="text-sm font-medium text-black leading-snug mb-2 group-hover:text-gray-700 transition-colors">
                                {post.title}
                            </p>
                            {post.excerpt && (
                                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mt-auto pt-2">
                                    {post.excerpt}
                                </p>
                            )}
                        </div>
                        <div className="px-5 pb-5 mt-auto">
                            <div className="flex items-center gap-1 text-xs text-[#4a8a1e] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                Read article
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}
