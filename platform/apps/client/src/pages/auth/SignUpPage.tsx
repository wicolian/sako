import { SignUp } from "@clerk/clerk-react";

export const SignUpPage = () => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
        </div>
    );
};
