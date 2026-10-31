import { SignedIn, SignedOut, RedirectToSignIn, useUser } from "@clerk/clerk-react";
import React from "react";

const allowedDomains = (import.meta.env.VITE_STUDIO_ALLOWED_DOMAINS || 'trysako.com,sako.design,sako.agency')
    .split(',')
    .map((d: string) => d.trim().toLowerCase())
    .filter(Boolean);
const allowedEmails = [
    'demo@trysako.com',
    'admin@trysako.com',
];

export const StudioProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { user, isLoaded } = useUser();

    if (!isLoaded) {
        return <div className="min-h-screen flex items-center justify-center">
            <div className="text-gray-600">Loading...</div>
        </div>;
    }

    return (
        <>
            <SignedIn>
                <DomainGate>
                    {children}
                </DomainGate>
            </SignedIn>
            <SignedOut>
                <RedirectToSignIn />
            </SignedOut>
        </>
    );
};

const DomainGate = ({ children }: { children: React.ReactNode }) => {
    const { user } = useUser();
    const email = user?.primaryEmailAddress?.emailAddress || '';
    const domain = email.split('@')[1] || '';

    const isAllowedDomain = allowedDomains.includes(domain.toLowerCase());
    const isAllowedEmail = allowedEmails.includes(email.toLowerCase());

    if (!isAllowedDomain && !isAllowedEmail) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="max-w-md p-8 bg-white rounded-lg shadow-sm border border-gray-200">
                    <h1 className="text-2xl font-semibold text-gray-900 mb-4">
                        Not Authorized
                    </h1>
                    <p className="text-gray-600 mb-4">
                        Access to SAKO Studio is restricted to internal team members.
                    </p>
                    <p className="text-sm text-gray-500">
                        Please use an email address on one of these domains: {allowedDomains.map((d: string) => '@' + d).join(', ')}.
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
