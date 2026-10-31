import Link from "next/link";

const COMPARE_LINKS = [
  { href: "/compare/agencies", label: "Sako vs Agencies" },
  { href: "/compare/design-pickle", label: "Sako vs Design Pickle" },
  { href: "/compare/manypixels", label: "Sako vs ManyPixels" },
  { href: "/compare/flocksy", label: "Sako vs Flocksy" },
  { href: "/compare/superside", label: "Sako vs Superside" },
  { href: "/compare/freelancers", label: "Sako vs Freelancers" },
  { href: "/compare/in-house", label: "Sako + In-House" },
] as const;

export function CompareMore() {
  return (
    <section className="py-16 px-6">
      <div className="max-w-4xl mx-auto">
        <p className="text-xs font-bold text-[#6B9E2E] uppercase tracking-[0.2em] mb-6">
          Compare more
        </p>
        <div className="flex flex-wrap gap-2">
          {COMPARE_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group inline-flex items-center px-4 py-2.5 rounded-full border-2 border-gray-200 bg-white text-sm font-semibold text-gray-900 hover:border-[#9AE83E] hover:bg-[#9AE83E]/10 hover:text-[#1a1a1a] transition-all duration-200"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
