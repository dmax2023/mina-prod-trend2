DROP POLICY IF EXISTS "recipients_public_all" ON public.notification_recipients;
DROP POLICY IF EXISTS "logs_public_read" ON public.notification_logs;

REVOKE ALL ON public.notification_recipients FROM anon, authenticated;
REVOKE ALL ON public.notification_logs FROM anon, authenticated;

GRANT ALL ON public.notification_recipients TO service_role;
GRANT ALL ON public.notification_logs TO service_role;