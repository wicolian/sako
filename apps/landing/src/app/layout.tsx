import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  preload: true,
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false, // Less critical, can load later
});

export const metadata: Metadata = {
  title: "Sako | Design Ops for B2B SaaS",
  description:
    "Sako plugs a dedicated design & motion pod into your Slack. You drop briefs in, we ship production-ready pages, decks, and motion assets in a strict 48-hour cycle. No interviews, no contracts, just shipping.",
  keywords: [
    "design ops",
    "B2B SaaS design",
    "motion design",
    "design systems",
    "creative operations",
    "landing pages",
    "product design",
    "design agency",
    "SaaS design",
    "startup design",
    "design subscription",
    "creative team",
    "design workflow",
    "48-hour design",
    "design SLA"
  ],
  authors: [{ name: "Sako Team" }],
  creator: "Creative Ops, Inc.",
  publisher: "Creative Ops, Inc.",
  icons: {
    icon: [{ url: "/favicons/favicon/favicon.svg", type: "image/svg+xml", sizes: "any" }],
    shortcut: "/favicons/favicon/favicon.svg",
    apple: "/favicons/favicon/favicon.svg",
  },

  // Add PWA manifest
  manifest: "/favicons/favicon/site.webmanifest",
  openGraph: {
    title: "Sako | Design Ops for B2B SaaS",
    description:
      "Stop waiting on design. Start shipping launches. Design & motion pod for B2B SaaS & Scale-ups.",
    type: "website",
    url: "https://trysako.com",
    siteName: "Sako",
    locale: "en_US",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Sako | Design Ops for B2B SaaS",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sako | Design Ops for B2B SaaS",
    description: "Design & motion pod for B2B SaaS. Ship production-ready assets in 48 hours.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "Ub8IuKCStg5hGyHRoOZbHYT59UoqAWX8w-A4gi9eDrk",
    other: {
      "google-site-verification": [
        "GF-lfa6EUP31Hw3_dwHhEuS8SG2r2XgTwsqDpzJPHB4",
      ],
    },
  },
  metadataBase: new URL("https://trysako.com"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID || 'GTM-PJSB6C3Q';
  const leadfeederId = process.env.NEXT_PUBLIC_LEADFEEDER_ID || 'bElvO736wrb8ZMqj';
  const reb2bKey = process.env.NEXT_PUBLIC_REB2B_KEY || '7N850H53Z1N1';

  return (
    <html lang="en" className="scroll-smooth" data-scroll-behavior="smooth">
      <body
        className={`${playfair.variable} ${geistSans.variable} ${geistMono.variable} antialiased overflow-x-hidden text-[#0A0A0A] bg-neutral-100 font-sans`}
      >
        {/* GTM noscript fallback */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
            title="Google Tag Manager"
          />
        </noscript>
        {children}
        <Analytics />
        <SpeedInsights />
        {/* GTM Script */}
        <Script
          id="gtm"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${gtmId}');
            `,
          }}
        />
        {/* Leadfeeder - official script from Leadfeeder dashboard */}
        <Script
          id="leadfeeder"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `
              (function(ss,ex){ window.ldfdr=window.ldfdr||function(){(ldfdr._q=ldfdr._q||[]).push([].slice.call(arguments));}; (function(d,s){ fs=d.getElementsByTagName(s)[0]; function ce(src){ var cs=d.createElement(s); cs.src=src; cs.async=1; fs.parentNode.insertBefore(cs,fs); }; ce('https://sc.lfeeder.com/lftracker_v1_'+ss+(ex?'_'+ex:'')+'.js'); })(document,'script'); })('${leadfeederId}');
            `,
          }}
        />
        {/* Apollo Website Tracker */}
        <Script
          id="apollo-tracker"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              function initApollo(){
                var n=Math.random().toString(36).substring(7),
                    o=document.createElement("script");
                o.src="https://assets.apollo.io/micro/website-tracker/tracker.iife.js?nocache="+n;
                o.async=true;
                o.defer=true;
                o.onload=function(){
                  window.trackingFunctions.onLoad({appId:"695b955a87eef1000d06a34d"})
                };
                document.head.appendChild(o);
              }
              initApollo();
            `,
          }}
        />
        {/* RB2B B2B Tracker */}
        <Script
          id="reb2b"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(key){
                if(window.reb2b)return;
                window.reb2b={loaded:true};
                var s=document.createElement("script");
                s.async=true;
                s.src="https://ddwl4m2hdecbv.cloudfront.net/b/"+key+"/"+key+".js.gz";
                document.getElementsByTagName("script")[0].parentNode.insertBefore(s,document.getElementsByTagName("script")[0]);
              }("${reb2bKey}");
            `,
          }}
        />
      </body>
    </html>
  );
}
