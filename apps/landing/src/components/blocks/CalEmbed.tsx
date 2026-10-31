"use client";

import { useEffect } from "react";

interface CalEmbedProps {
  url?: string;
  height?: number;
  title?: string;
  subtitle?: string;
  namespace?: string;
  calLink?: string;
}

export function CalEmbed({ 
  url, 
  height = 760, 
  title, 
  subtitle,
  namespace = "sako-fit-check",
  calLink = "koushik-venkatesan-mmvnbd/sako-fit-check"
}: CalEmbedProps) {
  useEffect(() => {
    // Cal.com inline embed script
    (function (C: any, A: string, L: string) {
      let p = function (a: any, ar: any) { a.q.push(ar); };
      let d = C.document;
      C.Cal = C.Cal || function () {
        let cal = C.Cal;
        let ar = arguments;
        if (!cal.loaded) {
          cal.ns = {};
          cal.q = cal.q || [];
          d.head.appendChild(d.createElement("script")).src = A;
          cal.loaded = true;
        }
        if (ar[0] === L) {
          const api: any = function () { p(api, arguments); };
          const namespace = ar[1];
          api.q = api.q || [];
          if (typeof namespace === "string") {
            cal.ns[namespace] = cal.ns[namespace] || api;
            p(cal.ns[namespace], ar);
            p(cal, ["initNamespace", namespace]);
          } else p(cal, ar);
          return;
        }
        p(cal, ar);
      };
    })(window, "https://app.cal.com/embed/embed.js", "init");

    // Initialize Cal with namespace
    (window as any).Cal("init", namespace, { origin: "https://app.cal.com" });

    // Setup inline embed
    (window as any).Cal.ns[namespace]("inline", {
      elementOrSelector: `#my-cal-inline-${namespace}`,
      config: { layout: "month_view", theme: "light" },
      calLink: calLink,
    });

    // Configure UI theme and colors
    (window as any).Cal.ns[namespace]("ui", {
      theme: "light",
      cssVarsPerTheme: {
        light: { "cal-brand": "#9AE83E" },
        dark: { "cal-brand": "#9AE83E" }
      },
      hideEventTypeDetails: false,
      layout: "month_view"
    });
  }, [namespace, calLink]);

  return (
    <section className="py-12 px-6">
      <div className="max-w-[1000px] mx-auto">
        {(title || subtitle) && (
          <div className="text-center mb-8">
            {title && <h2 className="text-3xl sm:text-4xl font-medium text-black tracking-tight mb-4">{title}</h2>}
            {subtitle && <p className="text-gray-500 max-w-2xl mx-auto">{subtitle}</p>}
          </div>
        )}
        
        <div className="overflow-hidden">
          <div 
            id={`my-cal-inline-${namespace}`}
            style={{ width: "100%", height: `${height}px`, overflow: "scroll" }}
          />
        </div>
      </div>
    </section>
  );
}

