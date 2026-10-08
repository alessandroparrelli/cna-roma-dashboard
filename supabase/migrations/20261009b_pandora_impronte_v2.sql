-- pandora_impronte v2: incassi e insoluti scorrono per customer_trx_id
-- (indice univoco esistente) invece che per id: con id il DB doveva
-- leggere tutte le righe dell'altra società prima di trovare quelle giuste.
CREATE OR REPLACE FUNCTION public.pandora_impronte(p_tab text, p_azienda text, p_after bigint DEFAULT 0, p_limit int DEFAULT 20000)
RETURNS TABLE(id bigint, k text, h text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s text := chr(31);
BEGIN
  IF p_tab IN ('incassipandora','insolutipandora') THEN
    RETURN QUERY EXECUTE format($q$
      SELECT x.customer_trx_id::bigint, x.customer_trx_id::text,
        encode(sha256(convert_to(concat_ws($3,
          coalesce(x.customer_trx_id::text,''), coalesce(x.codice_cliente::text,''), coalesce(x.cliente::text,''),
          coalesce(x.numero_fattura::text,''), coalesce(x.riferimento::text,''), coalesce(x.tipo::text,''),
          coalesce(x.unita_operativa::text,''),
          coalesce(trim_scale(x.totale_fattura::numeric)::text,''), coalesce(trim_scale(x.totale_imponibile::numeric)::text,''),
          coalesce(trim_scale(x.totale_iva::numeric)::text,''), coalesce(x.tipo_pagamento::text,''),
          coalesce(trim_scale(x.saldo::numeric)::text,''),
          coalesce(x.data_fattura::text,''), coalesce(x.data_scadenza::text,''), coalesce(x.sede::text,''),
          coalesce(x.p_iva::text,''), coalesce(x.codice_fiscale::text,''), coalesce(x.indirizzo::text,''),
          coalesce(x.cap::text,''), coalesce(x.comune::text,''), coalesce(x.prov::text,''),
          coalesce(x.condiz_pagam::text,''), coalesce(x.org_idi::text,''), coalesce(x.codice_azienda::text,''),
          coalesce(x.azienda::text,''), coalesce(x.codicetipodoc::text,''), coalesce(x.codicetipodocaz::text,'')
        ),'UTF8')),'hex')
      FROM public.%I x WHERE x.codice_azienda = $1 AND x.customer_trx_id > $2 ORDER BY x.customer_trx_id LIMIT $4 $q$, p_tab)
    USING p_azienda, p_after, s, p_limit;
  ELSIF p_tab = 'fatturazionepandora' THEN
    RETURN QUERY
      SELECT x.id, concat_ws(s, coalesce(x.codice_cliente,''), coalesce(x.scadenza::text,''), coalesce(x.codice::text,'')),
        encode(sha256(convert_to(concat_ws(s,
          coalesce(x.codice_cliente::text,''), coalesce(x.p_iva::text,''), coalesce(x.scadenza::text,''),
          coalesce(x.codice::text,''), coalesce(x.descrizione::text,''),
          coalesce(trim_scale(x.importo::numeric)::text,''), coalesce(x.codice_azienda::text,''), coalesce(x.azienda::text,'')
        ),'UTF8')),'hex')
      FROM public.fatturazionepandora x WHERE x.codice_azienda = p_azienda AND x.id > p_after ORDER BY x.id LIMIT p_limit;
  ELSE
    RAISE EXCEPTION 'tabella non ammessa';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
