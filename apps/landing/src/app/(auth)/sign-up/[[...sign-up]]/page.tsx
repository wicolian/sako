import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="min-h-[80vh] flex items-center justify-center px-6 py-16">
      <SignUp />
    </main>
  );
}


