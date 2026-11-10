import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Users,
} from "lucide-react";

import { useSiteLogo } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NotificationBell } from "@/components/NotificationBell";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  ALLOWED_DOMAINS_LABEL,
  USER_ROLES,
  isAllowedInstitutionalEmail,
} from "@/lib/institutional-email";


import functionHallAsset from "@/assets/function-hall.jpg.asset.json";
import avrAsset from "@/assets/avr.jpg.asset.json";
import gymnasiumAsset from "@/assets/gymnasium.jpg.asset.json";

const functionHall = functionHallAsset.url;
const avr = avrAsset.url;
const gymnasium = gymnasiumAsset.url;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DCC Reservation — Book the Function Hall, AVR or Gym" },
      {
        name: "description",
        content:
          "Reserve DCC facilities online: choose the Function Hall, AVR, or Gymnasium, fill out the form, review, and submit your request.",
      },
      { property: "og:title", content: "DCC Reservation — Book the Function Hall, AVR or Gym" },
      {
        property: "og:description",
        content:
          "Reserve DCC facilities online: choose the Function Hall, AVR, or Gymnasium, fill out the form, review, and submit your request.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type FacilityId = "function-hall" | "avr" | "gymnasium";

const FACILITIES: {
  id: FacilityId;
  name: string;
  blurb: string;
  capacity: string;
  image: string;
}[] = [
  {
    id: "function-hall",
    name: "Function Hall",
    blurb: "Banquets, assemblies, and formal programs.",
    capacity: "Up to 100 – 200 guests",
    image: functionHall,
  },
  {
    id: "avr",
    name: "AVR",
    blurb: "Audio-Visual Room for seminars and screenings.",
    capacity: "Up to 120 guests",
    image: avr,
  },
  {
    id: "gymnasium",
    name: "Gymnasium",
    blurb: "Sports events, intramurals, and large gatherings.",
    capacity: "Up to 800 guests",
    image: gymnasium,
  },
];

type FormState = {
  fullName: string;
  schoolId: string;
  userRole: string;
  contact: string;
  email: string;
  date: string;
  startTime: string;
  endTime: string;
  guests: string;
  purpose: string;
  requests: string;
};

const EMPTY_FORM: FormState = {
  fullName: "",
  schoolId: "",
  userRole: "",
  contact: "",
  email: "",
  date: "",
  startTime: "",
  endTime: "",
  guests: "",
  purpose: "",
  requests: "",
};


const STEPS = ["Facility", "Details", "Review", "Confirmed"];

const TIME_OPTIONS: string[] = Array.from({ length: 4 * 24 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

function formatTime(value: string) {
  if (!value) return "—";
  const [h, m] = value.split(":").map(Number);
  const suffix = (h ?? 0) < 12 ? "AM" : "PM";
  const hour12 = (h ?? 0) % 12 === 0 ? 12 : (h ?? 0) % 12;
  return `${hour12}:${String(m ?? 0).padStart(2, "0")} ${suffix}`;
}

function TimeSelect({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <Select {...(value ? { value } : {})} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {TIME_OPTIONS.map((t) => (
          <SelectItem key={t} value={t}>
            {formatTime(t)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Index() {
  const navigate = useNavigate();
  const siteLogo = useSiteLogo();
  const [step, setStep] = useState(0);
  const [facility, setFacility] = useState<FacilityId | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [reference, setReference] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
      setUserId(session?.user.id ?? null);
      setAuthChecked(true);
    });
    supabase.auth.getSession().then(({ data: s }) => {
      setUserEmail(s.session?.user.email ?? null);
      setUserId(s.session?.user.id ?? null);
      setAuthChecked(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);


  useEffect(() => {
    if (userEmail && !form.email) setForm((prev) => ({ ...prev, email: userEmail }));
  }, [userEmail, form.email]);

  async function signOut() {
    await supabase.auth.signOut();
    setUserEmail(null);
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  const selected = useMemo(() => FACILITIES.find((f) => f.id === facility) ?? null, [facility]);

  const set = (key: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  function validate() {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (form.fullName.trim().length < 2) next.fullName = "Please enter your full name.";
    if (form.schoolId.trim().length < 3)
      next.schoolId = "Enter your institutional / school ID number.";
    if (!form.userRole) next.userRole = "Select Student, Faculty, or Staff.";
    if (!/^[0-9+()\-\s]{7,20}$/.test(form.contact.trim()))
      next.contact = "Enter a valid contact number.";
    if (!isAllowedInstitutionalEmail(form.email))
      next.email = `Use an institutional email (${ALLOWED_DOMAINS_LABEL}).`;

    if (!form.date) next.date = "Choose a reservation date.";
    else if (form.date < new Date().toISOString().slice(0, 10))
      next.date = "Date cannot be in the past.";
    if (!form.startTime) next.startTime = "Select a start time.";
    if (!form.endTime) next.endTime = "Select an end time.";
    else if (form.startTime && form.endTime <= form.startTime)
      next.endTime = "End time must be after the start time.";
    const guests = Number(form.guests);
    if (!form.guests || Number.isNaN(guests) || guests < 1 || guests > 2000)
      next.guests = "Enter the number of participants (1–2000).";
    if (form.purpose.trim().length < 5) next.purpose = "Briefly describe the purpose.";
    if (form.requests.length > 500) next.requests = "Keep special requests under 500 characters.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    if (!facility || !userId) return;
    setSubmitting(true);
    const ref = `DCC-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const { error } = await supabase.from("reservations").insert({
      user_id: userId,
      tracking_number: ref,
      facility: selected?.name ?? facility,
      full_name: form.fullName.trim(),
      school_id: form.schoolId.trim(),
      requester_role: form.userRole,
      contact_number: form.contact.trim(),
      email: form.email.trim(),

      reservation_date: form.date,
      start_time: form.startTime,
      end_time: form.endTime,
      guests: Number(form.guests),
      purpose: form.purpose.trim(),
      special_requests: form.requests.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Could not submit reservation", { description: error.message });
      return;
    }
    setReference(ref);
    setStep(3);
    toast.success("Reservation request submitted", { description: `Tracking number ${ref}` });
  }


  function reset() {
    setForm(EMPTY_FORM);
    setFacility(null);
    setErrors({});
    setReference("");
    setStep(0);
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="bg-hero text-primary-foreground">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={siteLogo}
              alt="Davao Central College seal"
              className="h-11 w-11 rounded-full bg-primary-foreground/15 object-contain p-0.5"
            />

            <div className="leading-tight">
              <p className="font-display text-lg font-bold">DCC Reservation</p>
              <p className="text-xs opacity-80">Facility booking portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden items-center gap-2 opacity-90 sm:flex">
              <MapPin className="h-4 w-4" /> DCC Campus
            </span>
            {authChecked &&
              (userEmail ? (
                <div className="flex items-center gap-2">
                  <span className="hidden max-w-[160px] truncate opacity-90 md:inline">
                    {userEmail}
                  </span>
                  {userId && <NotificationBell userId={userId} />}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      void signOut();
                    }}
                  >
                    <LogOut className="mr-1.5 h-4 w-4" /> Log out
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => navigate({ to: "/auth" })}>
                  Log in
                </Button>
              ))}
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-6 pb-14 pt-6">
          <h1 className="max-w-2xl text-4xl font-bold sm:text-5xl">
            Reserve a campus facility in a few simple steps.
          </h1>
          <p className="mt-3 max-w-xl text-sm opacity-85 sm:text-base">
            Pick a venue, fill out your details, review, and submit your request.
          </p>
        </div>
      </header>

      {!authChecked ? (
        <div className="grid place-items-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !userEmail ? (
        <div className="mx-auto max-w-md px-6 py-16 text-center">
          <div className="rounded-2xl border bg-card p-8 shadow-card">
            <h2 className="text-xl font-bold">Sign in to reserve a facility</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Log in with Google or your email to start a reservation. New users can register in
              seconds.
            </p>
            <Button className="mt-6 w-full" onClick={() => navigate({ to: "/auth" })}>
              Log in or register
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mx-auto max-w-5xl px-6">
            <nav aria-label="Progress" className="-mt-8 rounded-2xl border bg-card p-4 shadow-card">
              <ol className="flex items-center gap-2">
                {STEPS.map((label, i) => (
                  <li key={label} className="flex flex-1 items-center gap-2">
                    <span
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold transition-colors",
                        i <= step
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                    </span>
                    <span
                      className={cn(
                        "hidden text-sm font-medium sm:block",
                        i <= step ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {label}
                    </span>
                    {i < STEPS.length - 1 && (
                      <span
                        className={cn("h-px flex-1 rounded", i < step ? "bg-primary" : "bg-border")}
                      />
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          </div>

          <div className="mx-auto max-w-5xl px-6 py-10">
            {step === 0 && (
              <section>
                <h2 className="text-2xl font-bold">Choose a facility</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select the venue you would like to reserve.
                </p>
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {FACILITIES.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setFacility(f.id);
                        setStep(1);
                      }}
                      className={cn(
                        "group overflow-hidden rounded-2xl border bg-card text-left shadow-card transition-all hover:-translate-y-1 hover:shadow-lift",
                        facility === f.id && "ring-2 ring-ring",
                      )}
                    >
                      <img
                        src={f.image}
                        alt={`${f.name} at DCC`}
                        width={1024}
                        height={640}
                        loading="lazy"
                        className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="space-y-1 p-5">
                        <h3 className="text-lg font-bold">{f.name}</h3>
                        <p className="text-sm text-muted-foreground">{f.blurb}</p>
                        <p className="flex items-center gap-1.5 pt-2 text-xs font-medium text-primary">
                          <Users className="h-3.5 w-3.5" /> {f.capacity}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {step === 1 && selected && (
              <section className="rounded-2xl border bg-card p-6 shadow-card sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold">Reservation details</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Reserving the{" "}
                      <span className="font-medium text-foreground">{selected.name}</span>
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setStep(0)}>
                    Change facility
                  </Button>
                </div>

                <Separator className="my-6" />

                <form
                  className="grid gap-5 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (validate()) setStep(2);
                    else toast.error("Please fix the highlighted fields.");
                  }}
                >
                  <Field label="Full name" error={errors.fullName}>
                    <Input
                      value={form.fullName}
                      maxLength={100}
                      onChange={(e) => set("fullName")(e.target.value)}
                      placeholder="Juan Dela Cruz"
                    />
                  </Field>
                  <Field label="Institutional / school ID number" error={errors.schoolId}>
                    <Input
                      value={form.schoolId}
                      maxLength={40}
                      onChange={(e) => set("schoolId")(e.target.value)}
                      placeholder="2023-00123"
                    />
                  </Field>
                  <Field label="User role" error={errors.userRole}>
                    <Select
                      {...(form.userRole ? { value: form.userRole } : {})}
                      onValueChange={set("userRole")}
                    >
                      <SelectTrigger>
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
                  </Field>
                  <Field label="Contact number" error={errors.contact}>
                    <Input
                      value={form.contact}
                      maxLength={20}
                      onChange={(e) => set("contact")(e.target.value)}
                      placeholder="09XX XXX XXXX"
                    />
                  </Field>
                  <Field label="Institutional email address" error={errors.email}>
                    <Input
                      type="email"
                      value={form.email}
                      maxLength={255}
                      onChange={(e) => set("email")(e.target.value)}
                      placeholder="you@gmail.com"
                    />
                  </Field>

                  <Field label="Reservation date" error={errors.date}>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(e) => set("date")(e.target.value)}
                    />
                  </Field>
                  <Field label="Start time" error={errors.startTime}>
                    <TimeSelect
                      value={form.startTime}
                      onChange={set("startTime")}
                      placeholder="Select start time"
                    />
                  </Field>
                  <Field label="End time" error={errors.endTime}>
                    <TimeSelect
                      value={form.endTime}
                      onChange={set("endTime")}
                      placeholder="Select end time"
                    />
                  </Field>
                  <Field label="Number of participants / guests" error={errors.guests}>
                    <Input
                      type="number"
                      min={1}
                      max={2000}
                      value={form.guests}
                      onChange={(e) => set("guests")(e.target.value)}
                      placeholder="50"
                    />
                  </Field>
                  <Field label="Purpose of reservation" error={errors.purpose}>
                    <Input
                      value={form.purpose}
                      maxLength={150}
                      onChange={(e) => set("purpose")(e.target.value)}
                      placeholder="Department seminar"
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Special requests (optional)" error={errors.requests}>
                      <Textarea
                        rows={4}
                        value={form.requests}
                        maxLength={500}
                        onChange={(e) => set("requests")(e.target.value)}
                        placeholder="Sound system, extra chairs, projector setup…"
                      />
                    </Field>
                  </div>
                  <div className="flex justify-end gap-3 sm:col-span-2">
                    <Button type="button" variant="ghost" onClick={() => setStep(0)}>
                      Back
                    </Button>
                    <Button type="submit">Review reservation</Button>
                  </div>
                </form>
              </section>
            )}

            {step === 2 && selected && (
              <section className="rounded-2xl border bg-card p-6 shadow-card sm:p-8">
                <h2 className="text-2xl font-bold">Review your reservation</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Please confirm everything below is correct before submitting.
                </p>

                <div className="mt-6 overflow-hidden rounded-xl border">
                  <img
                    src={selected.image}
                    alt={`${selected.name} at DCC`}
                    width={1024}
                    height={640}
                    loading="lazy"
                    className="h-40 w-full object-cover"
                  />
                  <div className="grid gap-x-8 gap-y-4 p-6 sm:grid-cols-2">
                    <Row
                      label="Facility"
                      value={selected.name}
                      icon={<MapPin className="h-4 w-4" />}
                    />
                    <Row
                      label="Date"
                      value={formatDate(form.date)}
                      icon={<CalendarDays className="h-4 w-4" />}
                    />
                    <Row
                      label="Time"
                      value={`${formatTime(form.startTime)} – ${formatTime(form.endTime)}`}
                      icon={<Clock className="h-4 w-4" />}
                    />
                    <Row
                      label="Participants"
                      value={`${form.guests} guests`}
                      icon={<Users className="h-4 w-4" />}
                    />
                    <Row label="Full name" value={form.fullName} />
                    <Row label="School ID" value={form.schoolId} />
                    <Row label="User role" value={form.userRole} />

                    <Row
                      label="Contact"
                      value={form.contact}
                      icon={<Phone className="h-4 w-4" />}
                    />
                    <Row label="Email" value={form.email} icon={<Mail className="h-4 w-4" />} />
                    <Row label="Purpose" value={form.purpose} />
                    <div className="sm:col-span-2">
                      <Row label="Special requests" value={form.requests || "None"} />
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Edit details
                  </Button>
                  <Button
                    disabled={submitting}
                    onClick={() => {
                      void submit();
                    }}
                  >
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm reservation
                  </Button>
                </div>
              </section>
            )}

            {step === 3 && selected && (
              <section className="rounded-2xl border bg-card p-8 text-center shadow-card">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent text-primary">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h2 className="mt-5 text-2xl font-bold">Reservation request submitted</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Your request for the {selected.name} on {formatDate(form.date)} (
                  {formatTime(form.startTime)} – {formatTime(form.endTime)}) has been received and
                  is now <span className="font-semibold text-foreground">pending</span> review.
                </p>
                <p className="mt-5 inline-block rounded-lg bg-secondary px-5 py-3 font-display text-lg font-bold tracking-wide text-secondary-foreground">
                  {reference}
                </p>
                <p className="mx-auto mt-3 max-w-md rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary">
                  Please take note or screenshot this tracking number. You will need it to check the
                  status of your reservation.
                </p>
                <div className="mt-7 flex flex-wrap justify-center gap-3">
                  <Button onClick={reset}>Make another reservation</Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard?.writeText(reference);
                      toast.success("Tracking number copied");
                    }}
                  >
                    Copy tracking number
                  </Button>
                </div>
              </section>
            )}
          </div>
        </>
      )}

      <TrackReservation />

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        <span className="select-none">© 2026 DCC Reservation Facility Booking Portal</span>
      </footer>
    </main>
  );

}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm font-medium break-words">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type TrackResult = {
  tracking_number: string;
  facility: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  status: string;
  admin_note: string | null;
  updated_at: string;
};

const STATUS_COPY: Record<string, string> = {
  pending: "Waiting for review by the facilities office.",
  approved: "Approved — your booking is confirmed.",
  rejected: "Rejected. Please contact the facilities office.",
  cancelled: "This reservation was cancelled.",
  completed: "This reservation has been completed.",
};

function TrackReservation() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackResult | null>(null);
  const [notFound, setNotFound] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setNotFound(false);
    setResult(null);
    const { data, error } = await supabase.rpc("track_reservation", {
      _tracking_number: code.trim(),
    });
    setLoading(false);
    if (error) {
      toast.error("Could not look up that tracking number", { description: error.message });
      return;
    }
    const row = (data as TrackResult[] | null)?.[0];
    if (!row) {
      setNotFound(true);
      return;
    }
    setResult(row);
  }

  return (
    <section id="track" className="border-t bg-muted/30">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <h2 className="text-2xl font-bold">Track your reservation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the tracking number you received after submitting to see its current status.
        </p>
        <form className="mt-5 flex flex-wrap gap-3" onSubmit={search}>
          <Input
            value={code}
            maxLength={30}
            onChange={(e) => setCode(e.target.value)}
            placeholder="DCC-2026-XXXXX"
            className="max-w-xs flex-1 bg-background"
            aria-label="Tracking number"
          />
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Check status
          </Button>
        </form>

        {notFound && (
          <p className="mt-5 rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-card">
            No reservation found for that tracking number. Please check it and try again.
          </p>
        )}

        {result && (
          <div className="mt-5 rounded-xl border bg-card p-6 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-display text-sm font-bold tracking-wide text-primary">
                {result.tracking_number}
              </p>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold capitalize text-secondary-foreground">
                {result.status}
              </span>
            </div>
            <p className="mt-3 text-sm font-medium">
              {STATUS_COPY[result.status] ?? "Status updated."}
            </p>
            <div className="mt-4 grid gap-x-8 gap-y-3 border-t pt-4 sm:grid-cols-2">
              <Row label="Facility" value={result.facility} icon={<MapPin className="h-4 w-4" />} />
              <Row
                label="Date"
                value={formatDate(result.reservation_date)}
                icon={<CalendarDays className="h-4 w-4" />}
              />
              <Row
                label="Time"
                value={`${formatTime(result.start_time.slice(0, 5))} – ${formatTime(result.end_time.slice(0, 5))}`}
                icon={<Clock className="h-4 w-4" />}
              />
              <Row
                label="Last updated"
                value={new Date(result.updated_at).toLocaleString()}
              />
            </div>
            {result.admin_note && (
              <p className="mt-4 rounded-lg bg-muted p-3 text-sm">
                <span className="text-muted-foreground">Note from admin: </span>
                {result.admin_note}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
