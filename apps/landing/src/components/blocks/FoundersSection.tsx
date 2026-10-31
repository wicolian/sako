"use client";

import { DirectionAwareHover } from "@/components/ui/visuals/direction-aware-hover";

interface Founder {
  name: string;
  role: string;
  tagline: string;
  bullets: string[];
  imageUrl: string;
  linkedin: string;
}

const founders: Founder[] = [
  {
    name: "Your Founder",
    role: "Co-founder, GTM Design",
    tagline: "Product-level craft. Launch-level speed.",
    bullets: [
      "Led design at PickYourTrail, DoWhileAI, Freightify",
      "GTM pages, decks, motion, and conversion visuals",
    ],
    imageUrl: "/founders/koushik.jpg",
    linkedin: "https://www.linkedin.com/in/kelashik/",
  },
  {
    name: "Gowri Shankar (the delivery lead) Muthukumar",
    role: "Co-founder, Motion & Video",
    tagline: "Cutdowns, kinetic type, UI motion that ships.",
    bullets: [
      "Full-time freelancer turned operator",
      "Launch clips, demos, and motion systems",
    ],
    imageUrl: "/founders/gowri.jpg",
    linkedin: "https://www.linkedin.com/in/gowrishankarsanjay/",
  },
];

export function FoundersSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white mb-3">
            Meet the founders
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-lg">
            Design + motion ops built for fast GTM teams.
          </p>
        </div>

        {/* Founder Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {founders.map((founder) => (
            <a
              key={founder.name}
              href={founder.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-neutral-200/50 dark:hover:shadow-neutral-900/50 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950"
            >
              <DirectionAwareHover
                imageUrl={founder.imageUrl}
                className="h-[340px] md:h-[400px] w-full rounded-none"
                imageClassName="rounded-none object-top"
                childrenClassName="p-4 md:p-5"
              >
                <div className="space-y-1.5">
                  {/* Name */}
                  <h3 className="text-base md:text-lg font-semibold text-white leading-snug">
                    {founder.name}
                  </h3>

                  {/* Role with lime accent */}
                  <p className="text-lime-400 text-xs font-medium tracking-wide uppercase">
                    {founder.role}
                  </p>

                  {/* Tagline */}
                  <p className="text-white/85 text-xs md:text-sm italic pt-1">
                    {founder.tagline}
                  </p>

                  {/* Bullets */}
                  <ul className="space-y-1 pt-1.5">
                    {founder.bullets.map((bullet, idx) => (
                      <li
                        key={idx}
                        className="text-white/75 text-xs flex items-start gap-1.5"
                      >
                        <span className="text-lime-400 mt-px">•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </DirectionAwareHover>
            </a>
          ))}
        </div>

        {/* Founder Story */}
        <p className="text-center text-neutral-500 dark:text-neutral-400 text-base md:text-lg mt-12 max-w-2xl mx-auto leading-relaxed">
          Two Chennai kids who kept shipping design through Slack chaos. Sako is the pipeline we wished we had: clear capacity, tracked states, real deadlines.
        </p>
      </div>
    </section>
  );
}
