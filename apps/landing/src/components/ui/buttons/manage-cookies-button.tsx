"use client";

import { openCookieBanner } from "@/components/ui/feedback/cookie-consent-banner";

export function ManageCookiesButton() {
  return (
    <button
      type="button"
      onClick={openCookieBanner}
      className="text-[#9AE83E] hover:text-black underline underline-offset-2 transition-colors font-medium"
    >
      Manage Cookie Preferences
    </button>
  );
}

