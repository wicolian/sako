import { composerCopy } from "@/config/landing";

export function Composer() {
  return (
    <section
      className="py-24 px-6 bg-[#1a1a1a] text-white relative overflow-hidden min-h-screen flex items-center justify-center"
      id="composer"
    >
      {/* Abstract Tech Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.15),transparent_40%)]"></div>
      <div className="[mask-image:linear-gradient(to_bottom,black,transparent)] absolute top-0 right-0 bottom-0 left-0"></div>

      <div className="max-w-[1200px] mx-auto relative z-10 grid lg:grid-cols-2 gap-16 items-center w-full">
        {/* Content */}
        <div>
          <span className="text-[#9AE83E] font-mono text-xs uppercase tracking-widest mb-4 block">
            {composerCopy.eyebrow}
          </span>
          <h2 className="text-4xl sm:text-5xl font-medium tracking-tight mb-6">
            {composerCopy.title.start}
            <br />
            <span className="font-medium italic text-brand-serif-accent font-serif text-serif-accent text-serif-italic">
              {composerCopy.title.italic}
            </span>
          </h2>
          <div className="space-y-6 text-gray-400 text-sm leading-relaxed mb-8">
            <p>{composerCopy.description.intro}</p>
            <p>{composerCopy.description.listIntro}</p>
            <ul className="space-y-3 pl-4 border-l border-white/10">
              {composerCopy.description.list.map((item, index) => (
                <li key={index} className="flex items-center gap-2">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-[#9AE83E]"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <p>{composerCopy.description.outro}</p>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <a
              href={composerCopy.cta1.href}
              className="px-6 py-3 bg-[#9AE83E] text-black font-semibold text-sm rounded-full hover:bg-white transition-colors"
            >
              {composerCopy.cta1.label}
            </a>
            <a
              href={composerCopy.cta2.href}
              className="px-6 py-3 bg-white/10 border border-white/10 text-white font-medium text-sm rounded-full hover:bg-white/20 transition-colors"
            >
              {composerCopy.cta2.label}
            </a>
          </div>
        </div>

        {/* Visual Interface Mockup */}
        <div className="relative">
          <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
            {/* Window Header */}
            <div className="bg-[#1A1A1A] px-4 py-3 flex items-center gap-2 border-b border-white/5">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
              </div>
              <div className="ml-4 text-[10px] text-gray-500 font-mono">
                composer_v2.0 --draft
              </div>
            </div>
            {/* Terminal Body */}
            <div className="p-6 font-mono text-xs space-y-4 min-h-[400px]">
              <div className="flex gap-3">
                <span className="text-[#9AE83E] shrink-0">➜</span>
                <div className="text-gray-300">
                  <span className="opacity-50 text-[10px] block mb-1">
                    USER INPUT
                  </span>
                  Create a landing page for a B2B fin-tech startup called
                  &quot;Vault&quot;. Dark mode, trust-focused, with a pricing
                  section.
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <span className="text-[#9AE83E] shrink-0">⚡</span>
                <div className="text-[#9AE83E] w-full">
                  <span className="opacity-50 text-[10px] block mb-1 text-gray-500">
                    COMPOSER AI
                  </span>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 border border-[#9AE83E] border-t-transparent rounded-full animate-spin"></div>
                      <span>Analyzing brand system...</span>
                    </div>
                    <div className="text-gray-400">
                      Generative Layout:
                      <span className="text-white ml-1">Hero_Trust_v4</span>
                    </div>
                    <div className="text-gray-400">
                      Palette:
                      <span className="text-white ml-1">
                        Obsidian / Electric Blue
                      </span>
                    </div>
                    <div className="text-gray-400">
                      Components:
                      <span className="text-white ml-1">
                        Nav, Hero, SocialProof, Pricing_Table_3col, Footer
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-white/5 rounded border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white">Draft Ready</span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-[#9AE83E] text-black rounded">
                        VIEW
                      </span>
                    </div>
                    <div className="h-20 bg-gradient-to-br from-gray-800 to-black rounded border border-white/5"></div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/5 mt-4">
                <span className="text-gray-500 shrink-0">➜</span>
                <div className="text-gray-500 typing-cursor">
                  Add motion to the hero section...
                </div>
              </div>
            </div>
          </div>
          {/* Badge */}
          <div className="absolute -right-4 -bottom-4 bg-white text-black px-4 py-2 rounded-lg text-xs font-bold shadow-xl border border-gray-200 transform rotate-[-2deg]">
            48h to Production
          </div>
        </div>
      </div>
    </section>
  );
}

