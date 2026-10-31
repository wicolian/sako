import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider, useUser } from "@clerk/clerk-react";
import * as Sentry from "@sentry/react";
import { ApiProvider } from "./lib/ApiProvider";
import { WorkspaceProvider, useWorkspaceContext } from "./lib/WorkspaceProvider";
import App from "./App";
import "./index.css";
import { useEffect } from "react";

// Initialize Sentry (optional - only if DSN is provided)
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const SENTRY_RELEASE = import.meta.env.VITE_SENTRY_RELEASE;
const NODE_ENV = import.meta.env.MODE;
const IS_DEV = import.meta.env.DEV;

// Determine environment string
const getSentryEnvironment = (): string => {
  if (NODE_ENV === 'production') return 'client-production';
  if (NODE_ENV === 'staging') return 'client-staging';
  return 'client-development';
};

// Determine traces sample rate based on environment
const getTracesSampleRate = (): number => {
  if (NODE_ENV === 'production') return 0.3;
  return 1.0;
};

// Guard against multiple Sentry initializations (HMR in dev)
const SENTRY_INIT_KEY = '__sentry_initialized__';
const isSentryAlreadyInitialized = () => (window as any)[SENTRY_INIT_KEY] === true;
const markSentryInitialized = () => { (window as any)[SENTRY_INIT_KEY] = true; };

// Initialize Sentry with minimal config first (for error catching)
// Session Replay is deferred until after first paint
if (SENTRY_DSN && !isSentryAlreadyInitialized()) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: getSentryEnvironment(),
    release: SENTRY_RELEASE || undefined,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: getTracesSampleRate(),
    // Session Replay disabled initially - added after first paint for performance
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Send PII data
    sendDefaultPii: true,
    // Attach stack traces
    attachStacktrace: true,
  });
  markSentryInitialized();

  // Defer Session Replay initialization until after first paint (production only)
  if (!IS_DEV) {
    // Use proper fallback for requestIdleCallback (not supported on iOS Safari)
    const initReplay = () => {
      Sentry.addIntegration(Sentry.replayIntegration());
      // Update sample rates after adding the integration
      Sentry.getCurrentScope().setExtra('replayEnabled', true);
    };

    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(initReplay);
    } else {
      setTimeout(initReplay, 3000);
    }
  }

  // DEV utility: expose test error function
  if (IS_DEV) {
    (window as any).sakoThrowTestError = () => {
      throw new Error('Sako Sentry test error from client');
    };
  }
}

// Component to set Sentry user/workspace context and initialize analytics after first paint
function SentryContextProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const { workspace } = useWorkspaceContext();

  // Defer analytics initialization until after first paint
  useEffect(() => {
    const initAnalytics = async () => {
      const analytics = (await import("./lib/analytics")).default;
      
      if (isLoaded && user) {
        Sentry.setUser({
          id: user.id,
          email: user.primaryEmailAddress?.emailAddress,
          username: user.fullName || undefined,
        });
        analytics.identify(user.id, {
          email: user.primaryEmailAddress?.emailAddress,
          fullName: user.fullName || undefined,
        });
      } else if (isLoaded && !user) {
        Sentry.setUser(null);
        analytics.reset();
      }
    };

    // Use requestIdleCallback for better performance, with setTimeout fallback
    // requestIdleCallback is not supported on iOS Safari
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => initAnalytics());
    } else {
      setTimeout(() => initAnalytics(), 100);
    }
  }, [isLoaded, user]);

  useEffect(() => {
    if (workspace) {
      Sentry.setContext('workspace', {
        id: workspace.id,
        name: workspace.name,
        planCode: (workspace as any).planCode || (workspace as any).subscription?.planCode,
      });
      
      // Defer analytics workspace context
      import("./lib/analytics").then(({ default: analytics }) => {
        analytics.setWorkspaceContext(workspace.id, workspace.name);
      });
    }
  }, [workspace]);

  return <>{children}</>;
}

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const RootTree = (
  <Sentry.ErrorBoundary fallback={<div className="p-8 text-center text-red-600">Something went wrong. Please refresh the page.</div>}>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <ApiProvider>
        <WorkspaceProvider>
          <SentryContextProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </SentryContextProvider>
        </WorkspaceProvider>
      </ApiProvider>
    </ClerkProvider>
  </Sentry.ErrorBoundary>
);

createRoot(document.getElementById("root")!).render(RootTree);
