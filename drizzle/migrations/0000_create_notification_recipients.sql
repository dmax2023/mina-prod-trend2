CREATE TABLE public.notification_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX notification_recipients_email_key ON public.notification_recipients (lower(email));

CREATE TABLE public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_ref TEXT,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_recipients TO anon, authenticated;
GRANT ALL ON public.notification_recipients TO service_role;
GRANT SELECT ON public.notification_logs TO anon, authenticated;
GRANT ALL ON public.notification_logs TO service_role;

ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipients_public_all" ON public.notification_recipients FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "logs_public_read" ON public.notification_logs FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER notification_recipients_updated_at
BEFORE UPDATE ON public.notification_recipients
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();