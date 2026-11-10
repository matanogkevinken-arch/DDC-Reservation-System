CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.reservation_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'completed');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tracking_number text NOT NULL UNIQUE,
  facility text NOT NULL,
  full_name text NOT NULL,
  contact_number text NOT NULL,
  email text NOT NULL,
  reservation_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  guests integer NOT NULL,
  purpose text NOT NULL,
  special_requests text,
  status public.reservation_status NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reservations" ON public.reservations
FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own reservations" ON public.reservations
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all reservations" ON public.reservations
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update reservations" ON public.reservations
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.track_reservation(_tracking_number text)
RETURNS TABLE (
  tracking_number text,
  facility text,
  reservation_date date,
  start_time time,
  end_time time,
  status public.reservation_status,
  admin_note text,
  updated_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.tracking_number, r.facility, r.reservation_date, r.start_time, r.end_time,
         r.status, r.admin_note, r.updated_at
  FROM public.reservations r
  WHERE upper(r.tracking_number) = upper(trim(_tracking_number))
$$;

GRANT EXECUTE ON FUNCTION public.track_reservation(text) TO anon, authenticated;