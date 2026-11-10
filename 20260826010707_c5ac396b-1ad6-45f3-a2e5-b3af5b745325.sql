CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.notify_reservation_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, reservation_id, title, message)
    VALUES (
      NEW.user_id,
      NEW.id,
      'Reservation ' || NEW.status,
      'Your ' || NEW.facility || ' reservation (' || NEW.tracking_number || ') on ' ||
      to_char(NEW.reservation_date, 'Mon DD, YYYY') || ' is now ' || NEW.status || '.'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reservations_status_notify
AFTER UPDATE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.notify_reservation_status();