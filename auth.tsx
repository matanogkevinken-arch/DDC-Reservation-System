import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSiteLogo } from "@/lib/branding";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import {
  ALLOWED_DOMAINS_LABEL,
  USER_ROLES,
  isAllowedInstitutionalEmail,
} from "@/lib/institutional-email";


export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — DCC Reservation" },
      {
        name: "description",
        content:
          "Sign in or create an account to reserve the DCC Function Hall, AVR, or Gymnasium.",
      },
      { property: "og:title", content: "Sign in — DCC Reservation" },
      {
        property: "og:description",
        content: "Sign in or create an account to reserve DCC campus facilities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const siteLogo = useSiteLogo();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [userRole, setUserRole] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) navigate({ to: "/", replace: true });
      else setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setLoading(false);
      toast.error("Google sign-in failed", { description: result.error.message });
      return;
    }
    if (result.redirected) return;
    await router.invalidate();
    navigate({ to: "/", replace: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAllowedInstitutionalEmail(email)) {
      toast.error("Use an institutional email", {
        description: `Only ${ALLOWED_DOMAINS_LABEL} addresses can register or sign in.`,
      });
      return;
    }
    if (mode !== "forgot" && password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (mode === "signup" && !/^[0-9+()\-\s]{7,20}$/.test(phone.trim())) {
      toast.error("Enter a valid phone number.");
      return;
    }
    if (mode === "signup" && schoolId.trim().length < 3) {
      toast.error("Enter your institutional / school ID number.");
      return;
    }
    if (mode === "signup" && !userRole) {
      toast.error("Select your role: Student, Faculty, or Staff.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Reset link sent", { description: `Check ${email} for instructions.` });
        setMode("signin");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              phone_number: phone.trim(),
              school_id: schoolId.trim(),
              user_role: userRole,
            },

          },
        });
        if (error) throw error;
        if (data.session) {
          await router.invalidate();
          navigate({ to: "/", replace: true });
        } else {
          toast.success("Account created", {
            description: "Check your email to confirm your account, then sign in.",
          });
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        await router.invalidate();
        navigate({ to: "/", replace: true });
      }
    } catch (err) {
      toast.error("Something went wrong", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-hero px-6 py-12">
      <div className="relative w-full max-w-md rounded-2xl border bg-card p-8 shadow-card">
        <button
          type="button"
          aria-label="Close sign in"
          onClick={() => navigate({ to: "/" })}
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white p-2 shadow-sm">
            <img
              src={siteLogo}
              alt="Davao Central College seal"
              className="h-full w-full object-contain"
            />
          </div>

          <h1 className="mt-4 text-2xl font-bold">
            {mode === "signup"
              ? "Create your account"
              : mode === "forgot"
                ? "Reset your password"
                : "Sign in to DCC Reservation"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "forgot"
              ? "We'll email you a link to set a new password."
              : "Book the Function Hall, AVR, or Gymnasium."}
          </p>
        </div>

        {mode !== "forgot" && (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={loading}
              onClick={handleGoogle}
            >
              Continue with Google
            </Button>
            <div className="my-5 flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>
          </>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              maxLength={255}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@gmail.com"
            />
            <p className="text-xs text-muted-foreground">
              Only {ALLOWED_DOMAINS_LABEL} addresses are accepted.
            </p>
          </div>

          {mode === "signup" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  maxLength={20}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09XX XXX XXXX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-id">Institutional / school ID number</Label>
                <Input
                  id="school-id"
                  value={schoolId}
                  maxLength={40}
                  onChange={(e) => setSchoolId(e.target.value)}
                  placeholder="2023-00123"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-role">User role</Label>
                <Select
                  {...(userRole ? { value: userRole } : {})}
                  onValueChange={setUserRole}
                >
                  <SelectTrigger id="user-role">
                    <SelectValue placeholder="Select Student, Faculty, or Staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {USER_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {mode !== "forgot" && (

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  maxLength={72}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "signup"
              ? "Create account"
              : mode === "forgot"
                ? "Send reset link"
                : "Sign in"}
          </Button>
        </form>

        <div className="mt-5 space-y-2 text-center text-sm">
          {mode === "signin" && (
            <>
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setMode("forgot")}
              >
                Forgot password?
              </button>
              <p className="text-muted-foreground">
                New here?{" "}
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => setMode("signup")}
                >
                  Create an account
                </button>
              </p>
            </>
          )}
          {mode !== "signin" && (
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => setMode("signin")}
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
