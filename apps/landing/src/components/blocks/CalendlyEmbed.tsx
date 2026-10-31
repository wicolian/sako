"use client";

import { useEffect } from "react";

interface CalendlyEmbedProps {
  url: string;
  height?: number;
  title?: string;
  subtitle?: string;
}

export function CalendlyEmbed({ url, height = 700, title, subtitle }: CalendlyEmbedProps) {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
  }, []);
  
  return (
    <section className="py-24 px-6">
      <div className="max-w-[1000px] mx-auto">
        {(title || subtitle) && (
          <div className="text-center mb-12">
            {title && <h2 className="text-3xl sm:text-4xl font-medium text-black tracking-tight mb-4">{title}</h2>}
            {subtitle && <p className="text-gray-500 max-w-2xl mx-auto">{subtitle}</p>}
          </div>
        )}
        
        <div className="bg-white rounded-3xl border border-gray-200 shadow-lg overflow-hidden">
          <div
            className="calendly-inline-widget"
            data-url={url}
            style={{ minWidth: "320px", height: `${height}px` }}
          />
        </div>
      </div>
    </section>
  );
}


