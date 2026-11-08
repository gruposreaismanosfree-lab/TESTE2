-- Não altera tabelas, políticas ou valores de limites existentes.
-- A reserva serializa solicitações do mesmo usuário para impedir ultrapassagem concorrente.
CREATE OR REPLACE FUNCTION public.reserve_study_request(p_user_id uuid, p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_limit integer;
  v_blocked boolean;
  v_used bigint;
  v_event uuid;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'Identificadores obrigatórios';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT daily_limit, blocked INTO v_limit, v_blocked
  FROM public.user_limits WHERE user_id = p_user_id;

  IF coalesce(v_blocked, false) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'blocked');
  END IF;

  IF v_limit IS NULL THEN
    SELECT default_daily_limit INTO v_limit FROM public.app_settings WHERE id = 1;
  END IF;

  IF v_limit IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'settings');
  END IF;

  SELECT count(*) INTO v_used FROM public.usage_events
  WHERE user_id = p_user_id
    AND created_at >= (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC');

  IF v_used >= v_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'limit');
  END IF;

  INSERT INTO public.usage_events (user_id, kind, request_id)
  VALUES (p_user_id, 'analysis', p_request_id)
  RETURNING id INTO v_event;

  RETURN jsonb_build_object('allowed', true, 'event_id', v_event);
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_study_request(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_study_request(uuid, uuid) TO service_role;
