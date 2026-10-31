# Sako | Design Ops for B2B SaaS

Sako plugs a dedicated design & motion pod into your Slack. Drop briefs in, and get production-ready pages, decks, and motion assets in a strict 48-hour cycle. No interviews, no contracts, just shipping.

## 🚀 Tech Stack

- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/)
- **Authentication**: [Clerk](https://clerk.com/)
- **Content Management**: [MDX](https://mdxjs.com/) via `next-mdx-remote`
- **Analytics**: [PostHog](https://posthog.com/), [Google Analytics](https://analytics.google.com/)
- **UI Components**: [Radix UI](https://www.radix-ui.com/), [Shadcn UI](https://ui.shadcn.com/)
- **Fonts**: Geist Sans, Geist Mono, Playfair Display

## 📂 Project Structure

- `src/app/`: Next.js App Router pages and API routes.
- `src/components/`: Reusable UI components.
  - `blocks/`: MDX-ready page sections (Hero, FeatureGrid, FAQ, etc.).
  - `landing/`: Specialized landing page sections.
  - `ui/`: Base UI components (Button, Input, etc.).
- `src/lib/`: Utility functions, MDX processors, and schemas.
- `content/`: MDX content files for all pages (legal, marketing, use cases).
- `public/`: Static assets (images, icons, fonts).

## ✨ Key Features

- **MDX-Powered Pages**: Dynamic content management allowing for flexible page layouts using React components directly in Markdown.
- **Strict SLA**: Built-in 48-hour delivery cycle for design assets.
- **Slack-to-Shipped**: Deep integration with Slack for seamless design briefs and feedback loops.
- **Design System**: Centralized design tokens and a comprehensive component library for consistent branding.
- **Analytics & Tracking**: Pre-configured PostHog and GA tracking for conversion optimization.
- **SEO Optimized**: Automated metadata generation and OG image creation.

## 🛠️ Development

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd sako-v1-mkt
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Environment Variables**:
   Create a `.env.local` file in the root and add the following:
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
   CLERK_SECRET_KEY=
   NEXT_PUBLIC_POSTHOG_KEY=
   NEXT_PUBLIC_POSTHOG_HOST=
   ```

4. **Run the development server**:
   ```bash
   pnpm dev
   ```

Open [http://localhost:3000](http://localhost:3000) to see the result.

## 🚢 Deployment

The project is optimized for deployment on [Vercel](https://vercel.com/).

```bash
pnpm build
```

## 📄 License

Proprietary - Creative Ops, Inc.
