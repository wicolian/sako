import { Suspense } from "react";
import { PostHogProvider } from "@/providers/PostHogProvider";
import { GoogleAnalytics } from "@/providers/GoogleAnalytics";
import { ConsoleEasterEgg } from "@/providers/ConsoleEasterEgg";
import { ScrollProgress } from "@/components/ui/animations/scroll-progress";
import { CookieConsentBanner } from "@/components/ui/feedback/cookie-consent-banner";
import { ScrollDemoPopup } from "@/components/blocks/ScrollDemoPopup";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <ScrollProgress />
      <Suspense fallback={null}>
        <PostHogProvider>
          <ConsoleEasterEgg />
          <GoogleAnalytics />
          {children}
          <ScrollDemoPopup />
          <CookieConsentBanner />
        </PostHogProvider>
      </Suspense>
    </>
  );
}


