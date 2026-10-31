import { ImageResponse } from "next/og";
import { client } from "@/sanity/client";
import { formatDate } from "@/lib/blog-helpers";

export const runtime = "edge";
export const alt = "Blog post cover";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const POST_QUERY = `*[_type == "post" && slug.current == $slug][0]{
  title, category, publishedAt, excerpt
}`;

const CATEGORY_COLORS: Record<string, string> = {
  "ROI & Revenue": "#16a34a",
  "Agency Comparison": "#2563eb",
  "Design Ops": "#7c3aed",
  "Process": "#9333ea",
  "Growth": "#059669",
  "Motion": "#db2777",
  "B2B Marketing": "#ea580c",
  "Informational": "#4b5563",
};

export default async function OGImage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const post = await client.fetch(POST_QUERY, { slug });

    if (!post) {
        return new ImageResponse(
            (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "100%",
                        height: "100%",
                        backgroundColor: "#0A0A0A",
                        color: "white",
                        fontSize: 48,
                        fontWeight: 700,
                        fontFamily: "system-ui, -apple-system, sans-serif",
                    }}
                >
                    Sako Journal
                </div>
            ),
            { ...size }
        );
    }

    const categoryColor = CATEGORY_COLORS[post.category ?? ""] ?? "#4b5563";
    // Truncate title at 72 chars
    const title = post.title.length > 72 ? post.title.slice(0, 69) + "…" : post.title;
    // Truncate excerpt at 130 chars
    const excerpt = post.excerpt
        ? post.excerpt.length > 130
            ? post.excerpt.slice(0, 127) + "…"
            : post.excerpt
        : null;

    return new ImageResponse(
        (
            <div
                style={{
                    display: "flex",
                    width: "100%",
                    height: "100%",
                    backgroundColor: "#0A0A0A",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                {/* Subtle radial glow top-center */}
                <div
                    style={{
                        position: "absolute",
                        top: -120,
                        left: "50%",
                        width: 700,
                        height: 400,
                        borderRadius: "50%",
                        background: "radial-gradient(ellipse, rgba(154,232,62,0.12) 0%, transparent 70%)",
                        transform: "translateX(-50%)",
                        display: "flex",
                    }}
                />

                {/* Green left accent bar */}
                <div
                    style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        width: 8,
                        height: "100%",
                        backgroundColor: "#9AE83E",
                        display: "flex",
                    }}
                />

                {/* Main content */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        width: "100%",
                        height: "100%",
                        padding: "56px 72px 56px 80px",
                    }}
                >
                    {/* Top row: Sako branding + category */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        {/* Logo */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                            }}
                        >
                            <div
                                style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: "50%",
                                    backgroundColor: "#9AE83E",
                                    display: "flex",
                                }}
                            />
                            <span
                                style={{
                                    color: "#9AE83E",
                                    fontSize: 18,
                                    fontWeight: 700,
                                    letterSpacing: "0.12em",
                                    textTransform: "uppercase",
                                }}
                            >
                                Sako Journal
                            </span>
                        </div>

                        {/* Category badge */}
                        {post.category && (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    padding: "8px 20px",
                                    borderRadius: 999,
                                    backgroundColor: `${categoryColor}22`,
                                    border: `1px solid ${categoryColor}55`,
                                    color: categoryColor,
                                    fontSize: 15,
                                    fontWeight: 600,
                                    letterSpacing: "0.04em",
                                }}
                            >
                                {post.category}
                            </div>
                        )}
                    </div>

                    {/* Center: Title + excerpt */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 20,
                            flex: 1,
                            justifyContent: "center",
                            paddingTop: 24,
                            paddingBottom: 24,
                        }}
                    >
                        <h1
                            style={{
                                fontSize: title.length > 55 ? 42 : title.length > 40 ? 50 : 58,
                                fontWeight: 800,
                                color: "#FFFFFF",
                                lineHeight: 1.2,
                                letterSpacing: "-0.025em",
                                margin: 0,
                                maxWidth: 900,
                            }}
                        >
                            {title}
                        </h1>
                        {excerpt && (
                            <p
                                style={{
                                    fontSize: 20,
                                    color: "rgba(255,255,255,0.55)",
                                    lineHeight: 1.5,
                                    margin: 0,
                                    maxWidth: 840,
                                    fontWeight: 400,
                                }}
                            >
                                {excerpt}
                            </p>
                        )}
                    </div>

                    {/* Bottom row: author + date + domain */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            borderTop: "1px solid rgba(255,255,255,0.08)",
                            paddingTop: 22,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 16,
                                color: "rgba(255,255,255,0.4)",
                                fontSize: 16,
                            }}
                        >
                            {/* Avatar circle */}
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: "50%",
                                    backgroundColor: "#9AE83E",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#000",
                                    fontSize: 14,
                                    fontWeight: 700,
                                }}
                            >
                                K
                            </div>
                            <span style={{ color: "rgba(255,255,255,0.6)" }}>
                                Your Founder
                            </span>
                            <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
                            <span>{formatDate(post.publishedAt)}</span>
                        </div>

                        <span
                            style={{
                                fontSize: 17,
                                fontWeight: 600,
                                color: "rgba(255,255,255,0.35)",
                                letterSpacing: "0.02em",
                            }}
                        >
                            trysako.com
                        </span>
                    </div>
                </div>
            </div>
        ),
        { ...size }
    );
}
