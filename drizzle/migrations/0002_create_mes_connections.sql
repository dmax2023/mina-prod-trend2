CREATE TABLE public.mes_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  base_url text NOT NULL,
  endpoints text[] NOT NULL DEFAULT '{}',
  token text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.mes_connections TO service_role;
ALTER TABLE public.mes_connections ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX mes_connections_one_active ON public.mes_connections ((true)) WHERE active;