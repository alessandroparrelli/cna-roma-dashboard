-- Import Pandora: tabelle di appoggio + merge che scrive solo le righe nuove/cambiate.
-- Sicuro da eseguire più volte. Non modifica le tabelle esistenti.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['incassipandora','insolutipandora','fatturazionepandora'] LOOP
    EXECUTE format('CREATE UNLOGGED TABLE IF NOT EXISTS public.stg_%s (LIKE public.%I INCLUDING DEFAULTS)', t, t);
    EXECUTE format('ALTER TABLE public.stg_%s DROP COLUMN IF EXISTS id, DROP COLUMN IF EXISTS pagato, DROP COLUMN IF EXISTS imported_at', t);
    EXECUTE format('ALTER TABLE public.stg_%s ADD COLUMN IF NOT EXISTS sid bigint GENERATED ALWAYS AS IDENTITY', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS stg_%s_az_sid ON public.stg_%s (codice_azienda, sid)', t, t);
    EXECUTE format('GRANT SELECT, INSERT, DELETE ON public.stg_%s TO anon, authenticated', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.pandora_stg_reset(p_tab text, p_azienda text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_tab NOT IN ('incassipandora','insolutipandora','fatturazionepandora') THEN RAISE EXCEPTION 'tabella non ammessa'; END IF;
  EXECUTE format('DELETE FROM public.stg_%s WHERE codice_azienda = $1', p_tab) USING p_azienda;
END $$;

CREATE OR REPLACE FUNCTION public.pandora_merge(p_tab text, p_azienda text, p_limit int DEFAULT 5000)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  keys text; cols text; sets text; cmp_t text; cmp_e text;
  max_sid bigint; n_changed int := 0; n_left int;
BEGIN
  IF p_tab NOT IN ('incassipandora','insolutipandora','fatturazionepandora') THEN RAISE EXCEPTION 'tabella non ammessa'; END IF;
  keys := CASE p_tab WHEN 'fatturazionepandora' THEN 'codice_cliente,codice_azienda,scadenza,codice'
                     ELSE 'customer_trx_id,codice_azienda' END;
  SELECT string_agg(quote_ident(column_name), ',' ORDER BY ordinal_position),
         string_agg(quote_ident(column_name)||'=EXCLUDED.'||quote_ident(column_name), ',' ORDER BY ordinal_position),
         string_agg('t.'||quote_ident(column_name), ',' ORDER BY ordinal_position),
         string_agg('EXCLUDED.'||quote_ident(column_name), ',' ORDER BY ordinal_position)
    INTO cols, sets, cmp_t, cmp_e
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='stg_'||p_tab AND column_name <> 'sid';

  EXECUTE format('SELECT max(sid) FROM (SELECT sid FROM public.stg_%s WHERE codice_azienda=$1 ORDER BY sid LIMIT $2) x', p_tab)
    INTO max_sid USING p_azienda, p_limit;
  IF max_sid IS NULL THEN RETURN json_build_object('changed',0,'left',0); END IF;

  EXECUTE format(
    'INSERT INTO public.%1$I AS t (%2$s, imported_at)
       SELECT DISTINCT ON (%3$s) %2$s, now() FROM public.stg_%1$s
       WHERE codice_azienda=$1 AND sid <= $2 ORDER BY %3$s, sid DESC
     ON CONFLICT (%3$s) DO UPDATE SET %4$s, imported_at = now()
     WHERE (%5$s) IS DISTINCT FROM (%6$s)',
    p_tab, cols, keys, sets, cmp_t, cmp_e) USING p_azienda, max_sid;
  GET DIAGNOSTICS n_changed = ROW_COUNT;

  EXECUTE format('DELETE FROM public.stg_%s WHERE codice_azienda=$1 AND sid <= $2', p_tab) USING p_azienda, max_sid;
  EXECUTE format('SELECT count(*) FROM public.stg_%s WHERE codice_azienda=$1', p_tab) INTO n_left USING p_azienda;
  RETURN json_build_object('changed', n_changed, 'left', n_left);
END $$;

REVOKE ALL ON FUNCTION public.pandora_stg_reset(text,text) FROM public;
REVOKE ALL ON FUNCTION public.pandora_merge(text,text,int) FROM public;
GRANT EXECUTE ON FUNCTION public.pandora_stg_reset(text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pandora_merge(text,text,int) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
