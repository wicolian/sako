/**
 * Utility to convert MDX content to clean Markdown for LLMs
 * Based on the pattern: fetch raw MDX -> strip imports -> expand components
 */

const IMPORT_STATEMENT_PATTERN = /^import\s+[\s\S]*?from\s+['"].*?['"];?\s*$/gm;
const FRONT_MATTER_PATTERN = /^---\s*[\s\S]*?---\s*/;

export async function prepareMarkdownForCopyAsync(
  rawContent: string,
  title: string,
  description: string
) {
  const preamble = "This content is from Sako's website. Please analyze if Sako's design ops solution would be suitable for my design needs.";
  
  if (!rawContent) {
    return `${preamble}\n\nTitle: ${title}\nDescription: ${description}`;
  }

  let content = rawContent;

  // Step 1: Remove front matter
  content = content.replace(FRONT_MATTER_PATTERN, '');

  // Step 2: Remove all import statements
  content = content.replace(IMPORT_STATEMENT_PATTERN, '');

  // Step 3: Convert common React components to Markdown equivalents
  
  // Robust Hero extraction (extracts title and subtitle regardless of order)
  content = content.replace(/<Hero\b([\s\S]*?)\/>/g, (match, props) => {
    const tMatch = props.match(/title="([^"]+)"/);
    const sMatch = props.match(/subtitle="([^"]+)"/);
    const t = tMatch ? tMatch[1].replace(/\{([^}]+)\}/g, '$1') : '';
    const s = sMatch ? sMatch[1] : '';
    return `# ${t}\n\n${s}\n\n`;
  });

  // Services page components expansion
  content = content.replace(/<ServicesHero\s*\/>/g, '# Services\n\nWe help in-house teams ship more marketing creative without the chaos. Design, web builds, and motion that stays on-brand, moves fast, and doesn’t turn into a month of meetings.\n\n');
  
  content = content.replace(/<CoreDesignBento\s*\/>/g, `## Core design
### Marketing design
* Landing pages, pricing pages, web sections
* Hero concepts, campaign layouts, signup flow screens
* Webinar and event pages, launch pages, feature pages
* Comparison pages, release graphics, product update visuals

### Pitch + sales decks
* Sales decks, investor decks, one-pagers
* Case studies, proposal decks, enablement slides
* Deck templates your team can reuse

### Ads + social design
* Paid ad creative, organic posts, carousels
* Banners, thumbnails, display ads
* Variant sets for testing and channel fit

### Product marketing design
* Feature and solution pages
* Launch kits and rollout assets
* Competitive comparison visuals

### Brand on rails
We apply your existing brand across everything. We don’t invent a new identity unless you ask for it.\n\n`);

  content = content.replace(/<WebBuildBento\s*\/>/g, `## Web build
### Figma to live
* Figma to Webflow
* Figma to Framer
* Approved Figma designs to Webflow/Framer
* Landing page iterations (A/B variants, new sections, performance-focused tweaks)
* Light implementation help (exports, responsive checks, spacing polish, component reuse)\n\n`);

  content = content.replace(/<MotionVideoBento\s*\/>/g, `## Motion + video
### Video editing
* Cutdowns, pacing, captions/subtitles
* Transitions, music, b-roll assembly
* Social-ready versions across formats

### Short-form content
* Reels/Shorts, ad creatives, product snippets
* Hook variants, resizes, caption styles

### Motion for marketing
* Logo stings, simple kinetic type
* UI callouts, social motion assets\n\n`);

  content = content.replace(/<OngoingSupportBento\s*\/>/g, `## Ongoing support
### Fast iterations
* Make it cleaner
* Match the brand
* Try 3 variants
* Resize for channels

### Template systems
* Social templates (Figma)
* Slide templates (Figma)
* Ad template sets for repeat campaigns

### Creative housekeeping
* Organized Figma files
* Consistent naming + versioning
* Handoff-ready files and clean exports\n\n`);

  content = content.replace(/<ScopeBoundaries\s*\/>/g, `## What we don’t do (hard no)
* 3D modeling, rendering, CGI
* VFX-heavy compositing
* Character animation, frame-by-frame, complex rigs
* Magazine or book layout workflows
* Packaging systems, dielines, vendor coordination
* InDesign-first, long document production
* Medical/legal/insurance compliance layouts
* Typesetting-heavy compliance formatting
* Full product UX ownership (research, testing, IA)
* App development (backend/frontend), QA automation

## Sometimes (ask first)
* Brand identity from scratch (logo, naming, full guidelines)
* Design systems (components, tokens, governance)
* Complex illustration styles
* Long-form video (10 to 30 min edits, multi-cam)
* Advanced motion (heavy After Effects, many scenes)
* Print collateral (limited, clearly scoped)\n\n`);

  content = content.replace(/<WebScopeBrief\s*\/>/g, `## Webflow/Framer scope brief
### Included
* Marketing pages (landing, pricing, features, comparison, about, contact, book-a-call)
* Responsive build (desktop/tablet/mobile)
* Basic SEO fields (title, meta, OG)
* Forms and embeds (Calendly, HubSpot, Typeform, etc.)
* Basic interactions (hover, scroll, reveal)
* Publish support (staging to live) plus one quick post-publish fix pass\n\n`);

  content = content.replace(/<FastestWin\s*\/>/g, `## Fastest win in week 1
Ship a campaign kit:
* 1 landing page refresh (hero, proof, CTA)
* 6 to 10 ad/social variants
* 2 short motion cutdowns (15 to 30s) with captions
Plus: templates so week 2 is faster.\n\n`);

  // Home page components
  content = content.replace(/<SlackToShipped\s*\/>/g, `## The Problem
You already know what to ship: landing page variants, deck refreshes, campaign creative, launch cutdowns. The problem is the handoff. Everything queues behind one person. Sako turns creative into a system: one queue, visible timers, capacity limits, and a team that stays in context.\n\n`);
  
  content = content.replace(/<WhySako\s*\/>/g, `## Why Sako
Built for B2B SaaS teams between 500k and 10M ARR. We focus on GTM, not everything. Predictable weekly shipping for launches, ads, webinars, and sales enablement.\n\n`);
  
  content = content.replace(/<HowItWorks\s*\/>/g, `## How it Works
1. Submit Brief: Submit in the dashboard.
2. First Draft: A fast first pass to lock direction.
3. Pod Active: Timer starts when the brief is Ready.
4. Review: Async review in the dashboard.
5. Ship: Delivered, versioned, and easy to find.\n\n`);
  
  content = content.replace(/<SakoOS\s*\/>/g, `## Sako OS
A system that keeps SLAs honest. Capacity is defined. Timers are visible. Delivery stays predictable.\n\n`);
  
  content = content.replace(/<Pricing\s*\/>/g, `## Pricing
* Core: $2,500/mo - 1 dedicated pod, unlimited GTM requests.
* Ops Base: $4,500/mo - 2 active pipelines, priority queue.
* Enterprise: Custom - 3+ parallel pipelines, GTM strategy.\n\n`);

  // <MetricCards ... />
  content = content.replace(/<MetricCards\b([\s\S]*?)\/>/g, (match, props) => {
    const tMatch = props.match(/title="([^"]+)"/);
    const titleText = tMatch ? `## ${tMatch[1].replace(/\{([^}]+)\}/g, '$1')}\n` : '';
    const itemsMatch = props.match(/items=\{\[([\s\S]*?)\]\}/);
    if (!itemsMatch) return titleText;
    const metricLines = itemsMatch[1].match(/title:\s*"([^"]+)"[\s\S]*?value:\s*"([^"]+)"[\s\S]*?description:\s*"([^"]+)"/g);
    if (!metricLines) return titleText;
    const items = metricLines.map((line: string) => {
      const m = line.match(/title:\s*"([^"]+)"[\s\S]*?value:\s*"([^"]+)"[\s\S]*?description:\s*"([^"]+)"/);
      return m ? `* **${m[1]}**: ${m[2]} - ${m[3]}` : '';
    }).join('\n');
    return `${titleText}${items}\n\n`;
  });

  // <FeatureGrid ... />
  content = content.replace(/<FeatureGrid\b([\s\S]*?)\/>/g, (match, props) => {
    const tMatch = props.match(/title="([^"]+)"/);
    const titleText = tMatch ? `## ${tMatch[1].replace(/\{([^}]+)\}/g, '$1')}\n` : '';
    const itemsMatch = props.match(/items=\{\[([\s\S]*?)\]\}/);
    if (!itemsMatch) return titleText;
    const featureLines = itemsMatch[1].match(/title:\s*"([^"]+)"[\s\S]*?description:\s*"([^"]+)"/g);
    if (!featureLines) return titleText;
    const items = featureLines.map((line: string) => {
      const m = line.match(/title:\s*"([^"]+)"[\s\S]*?description:\s*"([^"]+)"/);
      return m ? `### ${m[1].replace(/\{([^}]+)\}/g, '$1')}\n${m[2]}` : '';
    }).join('\n\n');
    return `${titleText}${items}\n\n`;
  });

  // <FAQAccordion ... />
  content = content.replace(/<FAQAccordion\b([\s\S]*?)\/>/g, (match, props) => {
    const itemsMatch = props.match(/items=\{\[([\s\S]*?)\]\}/);
    if (!itemsMatch) return '';
    const faqLines = itemsMatch[1].match(/question:\s*"([^"]+)"[\s\S]*?answer:\s*"([^"]+)"/g);
    if (!faqLines) return '';
    return `## FAQ\n\n` + faqLines.map((line: string) => {
      const m = line.match(/question:\s*"([^"]+)"[\s\S]*?answer:\s*"([^"]+)"/);
      return m ? `**Q: ${m[1]}**\nA: ${m[2]}` : '';
    }).join('\n\n') + '\n\n';
  });

  // <CTASection ... />
  content = content.replace(/<CTASection\b([\s\S]*?)\/>/g, (match, props) => {
    const tMatch = props.match(/title="([^"]+)"/);
    const sMatch = props.match(/subtitle="([^"]+)"/);
    const t = tMatch ? tMatch[1].replace(/\{([^}]+)\}/g, '$1') : '';
    const s = sMatch ? sMatch[1] : '';
    return `## ${t}\n${s}\n\n`;
  });

  // Generic component tag removal (but keep nested content if any)
  content = content.replace(/<[A-Z][a-zA-Z0-9]*\b[\s\S]*?\/>/g, '');
  content = content.replace(/<[A-Z][a-zA-Z0-9]*\b[\s\S]*?>([\s\S]*?)<\/[A-Z][a-zA-Z0-9]*>/g, '$1');
  
  // Clean up extra whitespace
  content = content.replace(/\n{3,}/g, '\n\n').trim();

  // Final assembly
  return `${preamble}

Title: ${title}
Description: ${description}

---

${content}`;
}

/**
 * Robust copy to clipboard utility that works on mobile
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for non-secure contexts or older mobile browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    }
  } catch (err) {
    console.error('Failed to copy: ', err);
    return false;
  }
}
