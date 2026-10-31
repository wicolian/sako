import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";

export const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
    return (
        <>
            <SignedIn>
                {children}
            </SignedIn>
            <SignedOut>
                <RedirectToSignIn />
            </SignedOut>
        </>
    );
};
