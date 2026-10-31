import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useWorkspaceContext } from '../../lib/WorkspaceProvider';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// TypeScript declaration for Stripe pricing table web component
declare global {
    namespace JSX {
        interface IntrinsicElements {
            'stripe-pricing-table': React.DetailedHTMLProps<
                React.HTMLAttributes<HTMLElement> & {
                    'pricing-table-id'?: string;
                    'publishable-key'?: string;
                    'customer-email'?: string;
                    'client-reference-id'?: string;
                },
                HTMLElement
            >;
        }
    }
}

export const PricingPage = () => {
    const { user, isLoaded } = useUser();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { workspace, loading: workspaceLoading } = useWorkspaceContext();
    const leadCaptured = useRef(false);

    // Redirect users who already have a workspace/subscription to dashboard
    useEffect(() => {
        if (isLoaded && !workspaceLoading && workspace) {
            navigate('/', { replace: true });
        }
    }, [workspace, workspaceLoading, isLoaded, navigate]);

    // Capture lead when signed-in user views pricing page (fire-and-forget)
    useEffect(() => {
        if (!isLoaded || !user?.primaryEmailAddress?.emailAddress) return;
        if (leadCaptured.current) return;

        // Debounce: only capture once per 24h per email
        const cacheKey = `leadCaptured:${user.primaryEmailAddress.emailAddress}`;
        const lastCapture = localStorage.getItem(cacheKey);
        if (lastCapture && Date.now() - parseInt(lastCapture, 10) < 24 * 60 * 60 * 1000) {
            return;
        }

        leadCaptured.current = true;

        // Extract UTM params
        const utm = {
            utmSource: searchParams.get('utm_source') || undefined,
            utmMedium: searchParams.get('utm_medium') || undefined,
            utmCampaign: searchParams.get('utm_campaign') || undefined,
            utmContent: searchParams.get('utm_content') || undefined,
            utmTerm: searchParams.get('utm_term') || undefined,
        };

        // Fire-and-forget lead capture
        fetch(`${API_BASE_URL}/marketing/capture-lead`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: user.primaryEmailAddress.emailAddress,
                source: 'pricing_page_view',
                name: user.fullName || undefined,
                ...utm,
            }),
        })
            .then(() => {
                localStorage.setItem(cacheKey, Date.now().toString());
            })
            .catch((err) => {
                // Silent failure - don't break user experience
                console.debug('Lead capture failed:', err);
            });
    }, [isLoaded, user, searchParams]);

    // Show loading while checking workspace
    if (isLoaded && workspaceLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#1a1a1a', color: '#fafafa' }}>
                <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-[#fafafa] border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    // Don't render pricing table if user already has workspace (will redirect)
    if (isLoaded && !workspaceLoading && workspace) {
        return null;
    }

    return (
        <div className="min-h-screen flex flex-col items-center px-4 py-12 font-sans" style={{ backgroundColor: '#1a1a1a', color: '#fafafa' }}>
            {/* Header */}
            <div className="flex flex-col items-center justify-center mb-12 space-y-3 max-w-2xl">
                <h1 className="text-4xl md:text-5xl tracking-tight text-center font-bold" style={{ color: '#fafafa' }}>
                    Select your plan
                </h1>
                <p className="text-base md:text-lg text-center leading-relaxed" style={{ color: '#fafafa' }}>
                    Choose the throughput and coverage that fits your team&apos;s needs.
                </p>
            </div>

            {/* Stripe Pricing Table */}
            <div className="w-full max-w-[1200px] mb-16">
                <stripe-pricing-table
                    pricing-table-id={import.meta.env.VITE_STRIPE_PRICING_TABLE_ID || "prctbl_1ScT48CtHBOocph1gdtFiyVB"}
                    publishable-key={import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY}
                    customer-email={isLoaded && user?.primaryEmailAddress?.emailAddress || undefined}
                    client-reference-id={isLoaded && user?.id || undefined}
                />
            </div>

            {/* Trust Footer */}
            <div className="pt-12 w-full max-w-[1200px]" style={{ borderTop: '1px solid rgba(250, 250, 250, 0.1)' }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                    <div className="flex flex-col items-center text-center space-y-3">
                        <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(250, 250, 250, 0.1)' }}>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#fafafa"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                                <path d="m9 12 2 2 4-4" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-semibold text-base mb-2" style={{ color: '#fafafa' }}>Secure &amp; Reliable</h3>
                            <p className="text-sm leading-relaxed" style={{ color: '#fafafa' }}>
                                Payments processed securely via Stripe. Your data is encrypted and safe.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-center text-center space-y-3">
                        <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(250, 250, 250, 0.1)' }}>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#fafafa"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M9 14 4 9l5-5" />
                                <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-semibold text-base mb-2" style={{ color: '#fafafa' }}>Flexible Pausing</h3>
                            <p className="text-sm leading-relaxed" style={{ color: '#fafafa' }}>
                                Pause your subscription anytime. Unused days roll over for up to 3-6 months.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-center text-center space-y-3">
                        <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(250, 250, 250, 0.1)' }}>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#fafafa"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <rect width="3" height="8" x="13" y="2" rx="1.5" />
                                <path d="M19 8.5V10h1.5A1.5 1.5 0 1 0 19 8.5" />
                                <rect width="3" height="8" x="8" y="14" rx="1.5" />
                                <path d="M5 15.5V14H3.5A1.5 1.5 0 1 0 5 15.5" />
                                <rect width="8" height="3" x="14" y="13" rx="1.5" />
                                <path d="M15.5 19H14v1.5a1.5 1.5 0 1 0 1.5-1.5" />
                                <rect width="8" height="3" x="2" y="8" rx="1.5" />
                                <path d="M8.5 5H10V3.5A1.5 1.5 0 1 0 8.5 5" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-semibold text-base mb-2" style={{ color: '#fafafa' }}>Integrated Workflow</h3>
                            <p className="text-sm leading-relaxed" style={{ color: '#fafafa' }}>
                                Direct communication via Slack and a dedicated dashboard for all plans above Core.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
