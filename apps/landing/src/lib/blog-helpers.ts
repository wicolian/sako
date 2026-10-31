// ── Blog Shared Utilities ────────────────────────────────────────────
// Single source of truth for heading IDs, TOC extraction, read-time, and types.
// Used by BlogContent.tsx, TableOfContents.tsx, and [slug]/page.tsx.

export interface ToCItem {
    id: string;
    text: string;
    level: 2 | 3 | 4;
}

export interface PTBlock {
    _type: string;
    style?: string;
    _key?: string;
    children?: { text?: string }[];
}

/** Extract plain text from a Portable Text block's children array */
export function blockText(value: { children?: { text?: string }[] }): string {
    return (value.children ?? []).map((c) => c.text ?? "").join("");
}

/** Slug-ify heading text for stable anchor IDs */
export function toId(raw: string): string {
    return raw
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 64);
}

/** Extract headings (h2/h3/h4) from Portable Text blocks for TOC */
export function extractHeadings(body: PTBlock[]): ToCItem[] {
    const seenIds = new Map<string, number>();
    return (body ?? [])
        .filter(
            (b) =>
                b._type === "block" && ["h2", "h3", "h4"].includes(b.style ?? "")
        )
        .map((b) => {
            const text = blockText(b);
            const baseId = toId(text);
            const count = seenIds.get(baseId) ?? 0;
            seenIds.set(baseId, count + 1);
            const id = count === 0 ? baseId : `${baseId}-${count + 1}`;
            return { id, text, level: (b.style === "h2" ? 2 : b.style === "h3" ? 3 : 4) as 2 | 3 | 4 };
        })
        .filter((h) => h.text);
}

/** Estimate reading time in minutes from Portable Text body */
export function readTime(body: PTBlock[]): number {
    const words = (body ?? [])
        .filter((b) => b._type === "block")
        .flatMap((b) => b.children ?? [])
        .map((c) => c.text ?? "")
        .join(" ")
        .split(/\s+/).length;
    return Math.max(4, Math.ceil(words / 200));
}

/** Format ISO date string to human-readable */
export function formatDate(d: string): string {
    return new Date(d).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

/**
 * Generate an SEO-friendly slug from a title.
 * Optional maxLen (default 20) caps length and appends a short hash for uniqueness.
 * NOTE: This is for FUTURE slug generation only. Existing Sanity slugs are NOT modified.
 */
export function generateSlug(
    title: string,
    maxLen: number = 20
): string {
    const base = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

    if (base.length <= maxLen) return base;

    // Trim to maxLen minus 5 chars for hash suffix
    const trimmed = base.slice(0, maxLen - 5).replace(/-$/, "");
    // Simple FNV-1a–inspired 4-char hash
    let hash = 2166136261;
    for (let i = 0; i < title.length; i++) {
        hash ^= title.charCodeAt(i);
        hash = (hash * 16777619) >>> 0;
    }
    const suffix = hash.toString(36).slice(0, 4);
    return `${trimmed}-${suffix}`;
}
