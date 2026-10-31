import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { login } from "../../lib/api";
import { isAuthenticated, setStoredAuth } from "../../lib/auth";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [workspace, setWorkspace] = useState("demo");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/studio/dashboard", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login({
        email,
        workspaceSlug: workspace.trim(),
        name: name || undefined,
      });

      setStoredAuth({
        token: result.token,
        workspaceId: result.workspace.id,
        workspaceSlug: result.workspace.slug,
        userId: result.user.id,
        userEmail: result.user.email,
        role: result.membership.role,
      });

      const redirectTo =
        (location.state as { from?: { pathname: string } })?.from?.pathname ||
        "/studio/dashboard";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to login. Try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center px-4">
      <div className="bg-[#141417] text-white rounded-2xl shadow-2xl border border-[#2b2b2f] p-8 w-full max-w-md">
        <h1 className="text-2xl font-semibold mb-2">Studio Access</h1>
        <p className="text-sm text-neutral-400 mb-6">
          Operators only. Use your workspace slug + email to continue.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="workspace" className="text-neutral-200">
              Workspace slug
            </Label>
            <Input
              id="workspace"
              type="text"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              placeholder="demo"
              autoComplete="organization"
              className="bg-[#1b1b1f] border-[#2f2f33] text-white placeholder:text-neutral-600"
              required
            />
          </div>
          <div>
            <Label htmlFor="email" className="text-neutral-200">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@trysako.com"
              autoComplete="email"
              className="bg-[#1b1b1f] border-[#2f2f33] text-white placeholder:text-neutral-600"
              required
            />
          </div>
          <div>
            <Label htmlFor="name" className="text-neutral-200">
              Name (optional)
            </Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Operator name"
              autoComplete="name"
              className="bg-[#1b1b1f] border-[#2f2f33] text-white placeholder:text-neutral-600"
            />
          </div>
          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 border border-red-900/40 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <Button
            type="submit"
            className="w-full bg-white text-black hover:bg-neutral-200"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
};

