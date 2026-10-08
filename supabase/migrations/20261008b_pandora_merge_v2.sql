-- pandora_merge v2: prima individua (in sola lettura) le righe nuove o cambiate,
-- poi scrive solo quelle. La v1 con ON CONFLICT bloccava ogni riga esistente
-- e andava in timeout (3s) anche con 0 modifiche.
CREATE OR REPLACE FUNCTION public.pandora_merge(p_tab text, p_azienda text, p_limit int DEFAULT 5000)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  keys text; jkeys text; k1 text; cols text; scols text; sets text; cmp_t text; cmp_s text;
  max_sid bigint; n_changed int := 0; n_left int;
BEGIN
  IF p_tab NOT IN ('incassipandora','insolutipandora','fatturazionepandora') THEN RAISE EXCEPTION 'tabella non ammessa'; END IF;
  IF p_tab = 'fatturazionepandora' THEN
    keys  := 'codice_cliente,codice_azienda,scadenza,codice';
    jkeys := 't.codice_cliente IS NOT DISTINCT FROM s.codice_cliente AND t.codice_azienda=s.codice_azienda AND t.scadenza IS NOT DISTINCT FROM s.scadenza AND t.codice IS NOT DISTINCT FROM s.codice';
    k1    := 'codice_azienda';
  ELSE
    keys  := 'customer_trx_id,codice_azienda';
    jkeys := 't.customer_trx_id=s.customer_trx_id AND t.codice_azienda=s.codice_azienda';
    k1    := 'customer_trx_id';
  END IF;
  SELECT string_agg(quote_ident(column_name), ',' ORDER BY ordinal_position),
         string_agg('s.'||quote_ident(column_name), ',' ORDER BY ordinal_position),
         string_agg(quote_ident(column_name)||'=EXCLUDED.'||quote_ident(column_name), ',' ORDER BY ordinal_position),
         string_agg('t.'||quote_ident(column_name), ',' ORDER BY ordinal_position),
         string_agg('s.'||quote_ident(column_name), ',' ORDER BY ordinal_position)
    INTO cols, scols, sets, cmp_t, cmp_s
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='stg_'||p_tab AND column_name <> 'sid';

  EXECUTE format('SELECT max(sid) FROM (SELECT sid FROM public.stg_%s WHERE codice_azienda=$1 ORDER BY sid LIMIT $2) x', p_tab)
    INTO max_sid USING p_azienda, p_limit;
  IF max_sid IS NULL THEN RETURN json_build_object('changed',0,'left',0); END IF;

  EXECUTE format(
    'INSERT INTO public.%1$I AS t (%2$s, imported_at)
       SELECT %3$s, now() FROM (
         SELECT DISTINCT ON (%4$s) * FROM public.stg_%1$s
         WHERE codice_azienda=$1 AND sid <= $2 ORDER BY %4$s, sid DESC) s
       LEFT JOIN public.%1$I t ON %5$s
       WHERE t.%6$s IS NULL OR (%7$s) IS DISTINCT FROM (%8$s)
     ON CONFLICT (%4$s) DO UPDATE SET %9$s, imported_at = now()',
    p_tab, cols, scols, keys, jkeys, k1, cmp_t, cmp_s, sets) USING p_azienda, max_sid;
  GET DIAGNOSTICS n_changed = ROW_COUNT;

  EXECUTE format('DELETE FROM public.stg_%s WHERE codice_azienda=$1 AND sid <= $2', p_tab) USING p_azienda, max_sid;
  EXECUTE format('SELECT count(*) FROM public.stg_%s WHERE codice_azienda=$1', p_tab) INTO n_left USING p_azienda;
  RETURN json_build_object('changed', n_changed, 'left', n_left);
END $$;
