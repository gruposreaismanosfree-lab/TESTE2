-- Painel administrativo: não concede papéis, não muda limites existentes
-- e não substitui as políticas das tabelas do projeto.
BEGIN;

CREATE OR REPLACE FUNCTION public.ws_admin_dashboard(p_page integer DEFAULT 0, p_search text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_search text := btrim(coalesce(p_search, ''));
  v_start timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_result jsonb;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = v_actor AND role::text = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acesso administrativo negado.' USING ERRCODE = '42501';
  END IF;
  IF p_page IS NULL OR p_page < 0 OR p_page > 1000000 OR length(v_search) > 120 THEN
    RAISE EXCEPTION 'Paginação ou busca inválida.' USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_build_object(
    'settings', (SELECT jsonb_build_object('default_daily_limit', s.default_daily_limit, 'updated_at', s.updated_at) FROM public.app_settings s WHERE s.id = 1),
    'total_users', (SELECT count(*) FROM public.profiles p WHERE v_search = '' OR p.email ILIKE '%' || v_search || '%' OR p.display_name ILIKE '%' || v_search || '%' OR p.id::text ILIKE '%' || v_search || '%'),
    'usage_today', (SELECT count(*) FROM public.usage_events e WHERE e.created_at >= v_start),
    'users', coalesce((
      SELECT jsonb_agg(to_jsonb(rows) ORDER BY rows.created_at DESC, rows.id)
      FROM (
        SELECT p.id, p.email, p.display_name, p.created_at, l.daily_limit,
          coalesce(l.blocked, false) AS blocked,
          (SELECT count(*) FROM public.usage_events e WHERE e.user_id = p.id AND e.created_at >= v_start) AS used_today
        FROM public.profiles p
        LEFT JOIN public.user_limits l ON l.user_id = p.id
        WHERE v_search = '' OR p.email ILIKE '%' || v_search || '%' OR p.display_name ILIKE '%' || v_search || '%' OR p.id::text ILIKE '%' || v_search || '%'
        ORDER BY p.created_at DESC, p.id
        LIMIT 20 OFFSET (p_page * 20)
      ) rows
    ), '[]'::jsonb),
    'errors', coalesce((
      SELECT jsonb_agg(to_jsonb(rows) ORDER BY rows.created_at DESC, rows.id)
      FROM (SELECT id, created_at, context, message, code, request_id, user_id FROM public.error_logs ORDER BY created_at DESC, id LIMIT 20) rows
    ), '[]'::jsonb),
    'audit', coalesce((
      SELECT jsonb_agg(to_jsonb(rows) ORDER BY rows.created_at DESC, rows.id)
      FROM (SELECT id, created_at, action, actor_id, target_id, details FROM public.admin_audit_log ORDER BY created_at DESC, id LIMIT 20) rows
    ), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.ws_admin_set_default_limit(p_daily_limit integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_before jsonb;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = v_actor AND role::text = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acesso administrativo negado.' USING ERRCODE = '42501';
  END IF;
  IF p_daily_limit IS NULL OR p_daily_limit < 0 THEN
    RAISE EXCEPTION 'Informe um limite inteiro não negativo.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ws-admin:settings', 0));
  SELECT jsonb_build_object('default_daily_limit', default_daily_limit)
    INTO v_before FROM public.app_settings WHERE id = 1 FOR UPDATE;

  INSERT INTO public.app_settings (id, default_daily_limit, updated_at, updated_by)
  VALUES (1, p_daily_limit, now(), v_actor)
  ON CONFLICT (id) DO UPDATE SET default_daily_limit = EXCLUDED.default_daily_limit, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;

  INSERT INTO public.admin_audit_log (actor_id, action, details)
  VALUES (v_actor, 'set_default_daily_limit', jsonb_build_object('before', v_before, 'after', jsonb_build_object('default_daily_limit', p_daily_limit)));
END;
$$;

CREATE OR REPLACE FUNCTION public.ws_admin_set_user_limit(p_user_id uuid, p_daily_limit integer, p_blocked boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_before jsonb;
  v_after jsonb;
  v_default integer;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = v_actor AND role::text = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acesso administrativo negado.' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_blocked IS NULL OR p_daily_limit < 0 THEN
    RAISE EXCEPTION 'Conta, limite ou bloqueio inválido.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Perfil não encontrado.' USING ERRCODE = '22023';
  END IF;

  -- Compartilha a trava da reserva de IA para serializar bloqueios e envios.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  SELECT jsonb_build_object('daily_limit', daily_limit, 'blocked', blocked)
    INTO v_before FROM public.user_limits WHERE user_id = p_user_id FOR UPDATE;

  IF p_daily_limit IS NULL THEN
    -- daily_limit é NOT NULL. Herança real corresponde à ausência da linha.
    -- Para bloquear com herança seria necessário um campo independente;
    -- por isso essa combinação é recusada sem inventar colunas.
    IF p_blocked THEN
      RAISE EXCEPTION 'Para bloquear a IA, desmarque Usar limite padrão e informe um limite individual.' USING ERRCODE = '22023';
    END IF;
    SELECT default_daily_limit INTO v_default FROM public.app_settings WHERE id = 1;
    IF v_default IS NULL THEN
      RAISE EXCEPTION 'Defina o limite padrão antes de ativar a herança.' USING ERRCODE = '22023';
    END IF;
    DELETE FROM public.user_limits WHERE user_id = p_user_id;
    v_after := jsonb_build_object('daily_limit', NULL, 'blocked', false, 'inherits_default', true);
  ELSE
    INSERT INTO public.user_limits (user_id, daily_limit, blocked, updated_at)
    VALUES (p_user_id, p_daily_limit, p_blocked, now())
    ON CONFLICT (user_id) DO UPDATE SET daily_limit = EXCLUDED.daily_limit, blocked = EXCLUDED.blocked, updated_at = EXCLUDED.updated_at;
    v_after := jsonb_build_object('daily_limit', p_daily_limit, 'blocked', p_blocked, 'inherits_default', false);
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, target_id, details)
  VALUES (v_actor, 'set_user_limit', p_user_id, jsonb_build_object('before', v_before, 'after', v_after));
END;
$$;

REVOKE ALL ON FUNCTION public.ws_admin_dashboard(integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ws_admin_set_default_limit(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ws_admin_set_user_limit(uuid, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ws_admin_dashboard(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ws_admin_set_default_limit(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ws_admin_set_user_limit(uuid, integer, boolean) TO authenticated;

COMMIT;
