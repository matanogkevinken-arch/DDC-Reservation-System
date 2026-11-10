import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  Building2,
  CalendarDays,
  CalendarPlus,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  LogOut,
  RefreshCw,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fileToLogoDataUrl, saveSiteLogo, useSiteLogo } from "@/lib/branding";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { cn } from "@/lib/utils";
import { ADMIN_EMAIL } from "@/lib/institutional-email";


export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Portal — DCC Reservation" },
      {
        name: "description",
        content:
          "Staff-only portal for reviewing DCC facility reservation requests and updating booking status.",
      },
      { property: "og:title", content: "Admin Portal — DCC Reservation" },
      {
        property: "og:description",
        content: "Review DCC facility reservations and update their status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type Status = "pending" | "approved" | "rejected" | "cancelled" | "completed";

const STATUSES: Status[] = ["approved", "rejected"];

// Actions an admin may apply to a booking.
const UPDATE_STATUSES: Status[] = ["approved", "rejected"];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
].map((label, i) => ({ label, value: String(i + 1).padStart(2, "0") }));

const FIRST_OPERATIONAL_YEAR = 2025;
const LAST_OPERATIONAL_YEAR = 2100;
const OPERATIONAL_YEARS_KEY = "operational_years";
const CURRENT_YEAR = Math.min(
  LAST_OPERATIONAL_YEAR,
  Math.max(FIRST_OPERATIONAL_YEAR, new Date().getFullYear()),
);

const REPORT_FACILITIES = ["Function Hall", "AVR", "Gymnasium"] as const;

const STATUS_STYLES: Record<Status, string> = {
  pending: "bg-secondary text-secondary-foreground",
  approved: "bg-primary text-primary-foreground",
  rejected: "bg-destructive text-destructive-foreground",
  cancelled: "bg-muted text-muted-foreground",
  completed: "bg-accent text-accent-foreground",
};

type Reservation = {
  id: string;
  tracking_number: string;
  facility: string;
  full_name: string;
  contact_number: string;
  email: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  guests: number;
  purpose: string;
  special_requests: string | null;
  status: Status;
  created_at: string;
};

function formatTime(value: string) {
  const [h, m] = value.split(":").map(Number);
  const suffix = (h ?? 0) < 12 ? "AM" : "PM";
  const hour12 = (h ?? 0) % 12 === 0 ? 12 : (h ?? 0) % 12;
  return `${hour12}:${String(m ?? 0).padStart(2, "0")} ${suffix}`;
}

function AdminPage() {
  const navigate = useNavigate();
  const siteLogo = useSiteLogo();
  const [phase, setPhase] = useState<"checking" | "login" | "denied" | "ready">("checking");
  const [authMode, setAuthMode] = useState<"signin" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Reservation[]>([]);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [dateFilter, setDateFilter] = useState("");
  const [yearFilter, setYearFilter] = useState(String(CURRENT_YEAR));
  const [monthFilter, setMonthFilter] = useState("all");
  const [operationalYears, setOperationalYears] = useState<number[]>([
    FIRST_OPERATIONAL_YEAR,
    CURRENT_YEAR,
  ]);
  const [addingYear, setAddingYear] = useState(false);
  const [newYear, setNewYear] = useState("");
  const [savingYear, setSavingYear] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingLogo(true);
    try {
      const dataUrl = await fileToLogoDataUrl(file);
      await saveSiteLogo(dataUrl);
      toast.success("Logo updated", { description: "The new logo now shows across the site." });
    } catch (err) {
      toast.error("Could not update the logo", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setUploadingLogo(false);
    }
  }

  const loadRows = useCallback(async () => {
    setLoadingRows(true);
    const [reservationsResult, yearsResult] = await Promise.all([
      supabase.from("reservations").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("value").eq("key", OPERATIONAL_YEARS_KEY).maybeSingle(),
    ]);
    setLoadingRows(false);
    const { data, error } = reservationsResult;
    if (error) {
      toast.error("Could not load reservations", { description: error.message });
      return;
    }
    const reservations = (data ?? []) as Reservation[];
    setRows(reservations);

    const yearsFromReservations = reservations
      .map((row) => Number(row.reservation_date.slice(0, 4)))
      .filter((year) => year >= FIRST_OPERATIONAL_YEAR && year <= LAST_OPERATIONAL_YEAR);
    let savedYears: number[] = [];
    if (yearsResult.data?.value) {
      try {
        const parsed: unknown = JSON.parse(yearsResult.data.value);
        if (Array.isArray(parsed)) {
          savedYears = parsed.filter(
            (year): year is number =>
              Number.isInteger(year) && year >= FIRST_OPERATIONAL_YEAR && year <= LAST_OPERATIONAL_YEAR,
          );
        }
      } catch {
        toast.error("Operational years could not be read");
      }
    }
    setOperationalYears(
      [...new Set([FIRST_OPERATIONAL_YEAR, CURRENT_YEAR, ...savedYears, ...yearsFromReservations])].sort(
        (a, b) => a - b,
      ),
    );
  }, []);

  const evaluate = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setPhase("login");
      return;
    }
    const signedInEmail = (userData.user.email ?? "").toLowerCase();
    const { data: allowed } = await supabase.rpc("claim_admin_strict");
    if (allowed !== true || signedInEmail !== ADMIN_EMAIL) {
      setPhase("denied");
      toast.error("Unauthorized Access", {
        description: "Only the official reservation office account may open the admin portal.",
      });
      await supabase.auth.signOut();
      navigate({ to: "/", replace: true });
      return;
    }
    setPhase("ready");
    await loadRows();
  }, [loadRows, navigate]);


  useEffect(() => {
    void evaluate();
  }, [evaluate]);

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/admin`,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed", { description: result.error.message });
      return;
    }
    if (result.redirected) return;
    setBusy(false);
    setPhase("checking");
    await evaluate();
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (email.trim().toLowerCase() !== ADMIN_EMAIL) {
      toast.error("Unauthorized Access", {
        description: "This email is not allowed in the admin portal.",
      });
      navigate({ to: "/", replace: true });
      return;
    }

    setBusy(true);
    if (authMode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setBusy(false);
      if (error) {
        toast.error("Could not send reset link", { description: error.message });
        return;
      }
      toast.success("Reset link sent", { description: `Check ${email} for instructions.` });
      setAuthMode("signin");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) {
      toast.error("Admin sign-in failed", { description: error.message });
      return;
    }
    setPhase("checking");
    await evaluate();
  }

  async function signOut() {
    await supabase.auth.signOut();
    setRows([]);
    setPhase("login");
    toast.success("Signed out of the admin portal");
  }

  async function addOperationalYear() {
    const year = Number(newYear);
    if (!Number.isInteger(year) || year < FIRST_OPERATIONAL_YEAR || year > LAST_OPERATIONAL_YEAR) {
      toast.error(`Enter a year from ${FIRST_OPERATIONAL_YEAR} to ${LAST_OPERATIONAL_YEAR}.`);
      return;
    }
    if (operationalYears.includes(year)) {
      setYearFilter(String(year));
      setAddingYear(false);
      setNewYear("");
      toast.info(`${year} is already available.`);
      return;
    }

    const nextYears = [...operationalYears, year].sort((a, b) => a - b);
    setSavingYear(true);
    const { error } = await supabase.from("app_settings").upsert({
      key: OPERATIONAL_YEARS_KEY,
      value: JSON.stringify(nextYears),
      updated_at: new Date().toISOString(),
    });
    setSavingYear(false);
    if (error) {
      toast.error("Could not add operational year", { description: error.message });
      return;
    }
    setOperationalYears(nextYears);
    setYearFilter(String(year));
    setAddingYear(false);
    setNewYear("");
    toast.success(`${year} added as an operational year.`);
  }

  async function updateStatus(row: Reservation, status: Status) {
    const previous = row.status;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status } : r)));
    const { error } = await supabase.from("reservations").update({ status }).eq("id", row.id);
    if (error) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: previous } : r)));
      toast.error("Status update failed", { description: error.message });
      return;
    }
    toast.success(`${row.tracking_number} marked ${status}`);
  }

  const tabRows = useMemo(
    () => rows.filter((r) => (tab === "completed" ? r.status === "completed" : r.status !== "completed")),
    [rows, tab],
  );

  const visible = tabRows.filter(
    (r) =>
      (filter === "all" || r.status === filter) &&
      (dateFilter === "" || r.reservation_date === dateFilter) &&
      (yearFilter === "all" || r.reservation_date.slice(0, 4) === yearFilter) &&
      (monthFilter === "all" || (r.reservation_date.split("-")[1] ?? "") === monthFilter),
  );

  const activeCount = rows.filter((r) => r.status !== "completed").length;
  const completedCount = rows.length - activeCount;
  const monthLabel = MONTHS.find((m) => m.value === monthFilter)?.label ?? "";
  const selectedYearRows = rows.filter(
    (row) => yearFilter === "all" || row.reservation_date.slice(0, 4) === yearFilter,
  );
  const selectedTimeframeRows = selectedYearRows.filter(
    (row) => monthFilter === "all" || row.reservation_date.slice(5, 7) === monthFilter,
  );
  const selectedParticipants = selectedTimeframeRows.reduce((sum, row) => sum + row.guests, 0);
  const timeframeLabel = [monthLabel, yearFilter === "all" ? "all years" : yearFilter]
    .filter(Boolean)
    .join(" ");
  const facilityCounts = REPORT_FACILITIES.map((facility) => ({
    facility,
    count: selectedTimeframeRows.filter((row) => row.facility === facility).length,
  }));

  return (
    <main className="min-h-screen bg-background">
      <header className="bg-hero text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <img
              src={siteLogo}
              alt="Davao Central College seal"
              className="h-11 w-11 rounded-full bg-primary-foreground/15 object-contain p-0.5"
            />
            <div className="leading-tight">
              <p className="font-display text-lg font-bold">DCC Admin Portal</p>
              <p className="text-xs opacity-80">Reservation management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => navigate({ to: "/" })}>
              Booking site
            </Button>
            {phase !== "login" && phase !== "checking" && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void signOut();
                }}
              >
                <LogOut className="mr-1.5 h-4 w-4" /> Log out
              </Button>
            )}
          </div>
        </div>
      </header>

      {phase === "checking" && (
        <div className="grid place-items-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {phase === "login" && (
        <div className="mx-auto max-w-md px-6 py-16">
          <div className="relative rounded-2xl border bg-card p-8 shadow-card">
            <button
              type="button"
              aria-label="Close admin sign in"
              onClick={() => navigate({ to: "/" })}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={siteLogo}
              alt="Davao Central College seal"
              className="mx-auto h-16 w-16 object-contain"
            />
            <h1 className="mt-4 text-center text-xl font-bold">
              {authMode === "forgot" ? "Reset admin password" : "Administrator sign in"}
            </h1>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              {authMode === "forgot"
                ? "We'll email you a link to set a new password."
                : "Restricted to the official reservation office account."}
            </p>


            {authMode === "signin" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-6 w-full"
                  disabled={busy}
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

            <form className="mt-6 space-y-4" onSubmit={handleLogin}>
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  maxLength={255}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@dcc.edu"
                />
              </div>
              {authMode === "signin" && (
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="admin-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      maxLength={72}
                      value={password}
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
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {authMode === "forgot" ? "Send reset link" : "Sign in as admin"}
              </Button>
            </form>

            <div className="mt-5 text-center text-sm">
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setAuthMode(authMode === "forgot" ? "signin" : "forgot")}
              >
                {authMode === "forgot" ? "Back to sign in" : "Forgot password?"}
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "denied" && (
        <div className="mx-auto max-w-md px-6 py-16 text-center">
          <div className="rounded-2xl border bg-card p-8 shadow-card">
            <h1 className="text-xl font-bold">Unauthorized Access</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This account is not allowed in the admin portal. Returning you to the booking site.
            </p>

            <Button
              className="mt-6 w-full"
              onClick={() => {
                void signOut();
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      )}

      {phase === "ready" && (
        <div className="mx-auto max-w-6xl px-6 py-10">
          <section aria-labelledby="booking-report-heading">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <BarChart3 className="h-4 w-4" /> Booking analytics
                </p>
                <h1 id="booking-report-heading" className="mt-1 text-2xl font-bold">
                  Report for {timeframeLabel}
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedTimeframeRows.length} {selectedTimeframeRows.length === 1 ? "booking" : "bookings"} in this view
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-lg border bg-card p-5 shadow-card">
                <CalendarDays className="h-5 w-5 text-primary" />
                <p className="mt-4 text-3xl font-bold">{selectedYearRows.length}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {yearFilter === "all" ? "Bookings across all years" : `Total bookings in ${yearFilter}`}
                </p>
              </article>
              <article className="rounded-lg border bg-card p-5 shadow-card">
                <BarChart3 className="h-5 w-5 text-primary" />
                <p className="mt-4 text-3xl font-bold">{selectedTimeframeRows.length}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {monthFilter === "all" ? "Bookings in selected year" : `Bookings in ${monthLabel}`}
                </p>
              </article>
              <article className="rounded-lg border bg-card p-5 shadow-card">
                <Users className="h-5 w-5 text-primary" />
                <p className="mt-4 text-3xl font-bold">{selectedParticipants.toLocaleString()}</p>
                <p className="mt-1 text-sm text-muted-foreground">Participants in selected timeframe</p>
              </article>
              <article className="rounded-lg border bg-card p-5 shadow-card">
                <Building2 className="h-5 w-5 text-primary" />
                <div className="mt-3 space-y-1.5 text-sm">
                  {facilityCounts.map(({ facility, count }) => (
                    <div key={facility} className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{facility}</span>
                      <span className="font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>

          <Separator className="my-8" />

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Reservation requests</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {rows.length} total · update a status and the customer sees it in tracking.
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition hover:bg-muted">
                {uploadingLogo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                Change logo
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={uploadingLogo}
                  onChange={(e) => {
                    void handleLogoFile(e);
                  }}
                />
              </label>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="w-36" aria-label="Filter by operational year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All years</SelectItem>
                  {operationalYears.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setAddingYear((value) => !value)}>
                <CalendarPlus className="h-4 w-4" /> Add year
              </Button>
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger className="w-40" aria-label="Filter by month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">View all months</SelectItem>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-44"
                aria-label="Filter by reservation date"
              />
              {dateFilter && (
                <Button variant="ghost" size="sm" onClick={() => setDateFilter("")}>
                  Clear date
                </Button>
              )}
              <Select value={filter} onValueChange={(v) => setFilter(v as "all" | Status)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  void loadRows();
                }}
                disabled={loadingRows}
              >
                <RefreshCw className={cn("h-4 w-4", loadingRows && "animate-spin")} />
              </Button>
            </div>
          </div>

          {addingYear && (
            <div className="mt-4 flex max-w-md flex-wrap items-end gap-2 rounded-lg border bg-card p-4 shadow-card">
              <div className="min-w-44 flex-1 space-y-2">
                <Label htmlFor="operational-year">New operational year</Label>
                <Input
                  id="operational-year"
                  type="number"
                  inputMode="numeric"
                  min={FIRST_OPERATIONAL_YEAR}
                  max={LAST_OPERATIONAL_YEAR}
                  value={newYear}
                  onChange={(event) => setNewYear(event.target.value)}
                  placeholder="e.g. 2027"
                />
              </div>
              <Button disabled={savingYear} onClick={() => void addOperationalYear()}>
                {savingYear && <Loader2 className="h-4 w-4 animate-spin" />}
                Save year
              </Button>
              <Button variant="ghost" onClick={() => setAddingYear(false)}>
                Cancel
              </Button>
            </div>
          )}

          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v as "active" | "completed");
              setFilter("all");
            }}
            className="mt-6"
          >
            <TabsList>
              <TabsTrigger value="active">Active ({activeCount})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({completedCount})</TabsTrigger>
            </TabsList>
          </Tabs>

          {(yearFilter !== "all" || monthFilter !== "all") && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Showing{" "}
                <span className="font-semibold text-foreground">{visible.length}</span>{" "}
                {visible.length === 1 ? "reservation" : "reservations"} for{" "}
                <span className="font-semibold text-foreground">{timeframeLabel}</span>
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setYearFilter("all");
                  setMonthFilter("all");
                }}
              >
                View all years and months
              </Button>
            </div>
          )}

          {dateFilter && (
            <p className="mt-4 text-sm text-muted-foreground">
              Showing reservations for{" "}
              <span className="font-semibold text-foreground">
                {new Date(`${dateFilter}T00:00:00`).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </p>
          )}

          {visible.length === 0 ? (
            <p className="mt-6 rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground shadow-card">
              {tab === "completed"
                ? "No completed reservations yet."
                : "No reservations to show yet."}
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {visible.map((r) => (
                <article
                  key={r.id}
                  className="rounded-2xl border bg-card p-5 shadow-card sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-display text-sm font-bold tracking-wide text-primary">
                        {r.tracking_number}
                      </p>
                      <h2 className="mt-1 text-lg font-bold">
                        {r.full_name} · {r.facility}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {new Date(`${r.reservation_date}T00:00:00`).toLocaleDateString(undefined, {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        · {formatTime(r.start_time)} – {formatTime(r.end_time)} · {r.guests} guests
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold capitalize",
                          STATUS_STYLES[r.status],
                        )}
                      >
                        {r.status}
                      </span>
                      <Select
                        {...(UPDATE_STATUSES.includes(r.status) ? { value: r.status } : {})}
                        onValueChange={(v) => {
                          void updateStatus(r, v as Status);
                        }}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="Update status" />
                        </SelectTrigger>
                        <SelectContent>
                          {UPDATE_STATUSES.map((s) => (
                            <SelectItem key={s} value={s} className="capitalize">
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-x-8 gap-y-2 border-t pt-4 text-sm sm:grid-cols-2">
                    <p>
                      <span className="text-muted-foreground">Contact: </span>
                      {r.contact_number}
                    </p>
                    <p className="break-words">
                      <span className="text-muted-foreground">Email: </span>
                      {r.email}
                    </p>
                    <p className="sm:col-span-2">
                      <span className="text-muted-foreground">Purpose: </span>
                      {r.purpose}
                    </p>
                    <p className="sm:col-span-2">
                      <span className="text-muted-foreground">Special requests: </span>
                      {r.special_requests || "None"}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        © 2026 DCC Reservation Facility Booking Portal · Admin
      </footer>
    </main>
  );
}
