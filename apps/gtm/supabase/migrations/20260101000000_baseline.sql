--
-- PostgreSQL database dump
--

\restrict wtYXtnA51lFNQ8cKxpvYlWr4aoVsIWbhQsZFiXQUdGkYcRZZPaphom7vJec9saw

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: assign_experiment_variant(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_experiment_variant(p_experiment_id uuid, p_visitor_id text, p_user_id text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_existing_assignment UUID;
  v_variant_id UUID;
  v_total_weight INT;
  v_random_weight INT;
  v_cumulative_weight INT := 0;
BEGIN
  -- Check for existing assignment
  SELECT variant_id INTO v_existing_assignment
  FROM experiment_assignments
  WHERE experiment_id = p_experiment_id AND visitor_id = p_visitor_id;
  
  IF v_existing_assignment IS NOT NULL THEN
    RETURN v_existing_assignment;
  END IF;
  
  -- Get total weight
  SELECT COALESCE(SUM(traffic_weight), 0) INTO v_total_weight
  FROM experiment_variants
  WHERE experiment_id = p_experiment_id;
  
  IF v_total_weight = 0 THEN
    RETURN NULL;
  END IF;
  
  -- Deterministic random based on visitor_id (consistent assignment)
  v_random_weight := abs(hashtext(p_visitor_id || p_experiment_id::text)) % v_total_weight;
  
  -- Select variant based on weight
  FOR v_variant_id IN
    SELECT id FROM experiment_variants 
    WHERE experiment_id = p_experiment_id
    ORDER BY created_at
  LOOP
    SELECT v_cumulative_weight + traffic_weight INTO v_cumulative_weight
    FROM experiment_variants WHERE id = v_variant_id;
    
    IF v_random_weight < v_cumulative_weight THEN
      -- Create assignment
      INSERT INTO experiment_assignments (experiment_id, variant_id, visitor_id, user_id)
      VALUES (p_experiment_id, v_variant_id, p_visitor_id, p_user_id)
      ON CONFLICT (experiment_id, visitor_id) DO NOTHING;
      
      RETURN v_variant_id;
    END IF;
  END LOOP;
  
  RETURN v_variant_id;
END;
$$;


--
-- Name: auto_title_chat_session(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_title_chat_session() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.role = 'user' THEN
    UPDATE chat_sessions 
    SET title = LEFT(NEW.content, 50) || CASE WHEN LENGTH(NEW.content) > 50 THEN '...' ELSE '' END
    WHERE id = NEW.session_id 
    AND title = 'New Chat';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: calculate_experiment_metrics(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_experiment_metrics(p_experiment_id uuid, p_date date DEFAULT CURRENT_DATE) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO experiment_metrics (
    experiment_id, variant_id, date,
    visitors, sessions, page_views,
    total_time_on_page_ms, avg_time_on_page_ms, avg_scroll_depth, bounces,
    conversions, conversion_value, conversion_rate, bounce_rate
  )
  SELECT 
    e.experiment_id,
    e.variant_id,
    p_date,
    COUNT(DISTINCT ea.visitor_id) as visitors,
    COUNT(DISTINCT e.metadata->>'session_id') as sessions,
    COUNT(*) FILTER (WHERE e.event_type = 'page_view') as page_views,
    COALESCE(SUM(e.time_on_page_ms), 0) as total_time_on_page_ms,
    COALESCE(AVG(e.time_on_page_ms)::INT, 0) as avg_time_on_page_ms,
    COALESCE(AVG(e.scroll_depth_percent)::INT, 0) as avg_scroll_depth,
    COUNT(*) FILTER (WHERE e.event_type = 'bounce') as bounces,
    COUNT(*) FILTER (WHERE e.is_conversion = TRUE) as conversions,
    COALESCE(SUM(e.conversion_value), 0) as conversion_value,
    CASE 
      WHEN COUNT(DISTINCT ea.visitor_id) > 0 
      THEN COUNT(*) FILTER (WHERE e.is_conversion = TRUE)::FLOAT / COUNT(DISTINCT ea.visitor_id)
      ELSE 0 
    END as conversion_rate,
    CASE 
      WHEN COUNT(*) FILTER (WHERE e.event_type = 'page_view') > 0 
      THEN COUNT(*) FILTER (WHERE e.event_type = 'bounce')::FLOAT / COUNT(*) FILTER (WHERE e.event_type = 'page_view')
      ELSE 0 
    END as bounce_rate
  FROM experiment_events e
  LEFT JOIN experiment_assignments ea ON e.assignment_id = ea.id
  WHERE e.experiment_id = p_experiment_id
    AND e.created_at::DATE = p_date
  GROUP BY e.experiment_id, e.variant_id
  ON CONFLICT (experiment_id, variant_id, date) DO UPDATE SET
    visitors = EXCLUDED.visitors,
    sessions = EXCLUDED.sessions,
    page_views = EXCLUDED.page_views,
    total_time_on_page_ms = EXCLUDED.total_time_on_page_ms,
    avg_time_on_page_ms = EXCLUDED.avg_time_on_page_ms,
    avg_scroll_depth = EXCLUDED.avg_scroll_depth,
    bounces = EXCLUDED.bounces,
    conversions = EXCLUDED.conversions,
    conversion_value = EXCLUDED.conversion_value,
    conversion_rate = EXCLUDED.conversion_rate,
    bounce_rate = EXCLUDED.bounce_rate,
    updated_at = NOW();
END;
$$;


--
-- Name: check_budget_alerts(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_budget_alerts(p_workspace_id uuid) RETURNS TABLE(alert_id uuid, should_notify boolean, message text)
    LANGUAGE plpgsql
    AS $_$
DECLARE
  v_alert RECORD;
  v_current_usage DECIMAL(10,2);
  v_budget_limit DECIMAL(10,2);
  v_percentage DECIMAL(5,2);
  v_should_notify BOOLEAN;
BEGIN
  -- Get current month's usage (simplified - actual implementation would query ai_traces)
  SELECT COALESCE(SUM(cost), 0) INTO v_current_usage
  FROM ai_traces
  WHERE workspace_id = p_workspace_id
  AND created_at >= date_trunc('month', NOW());
  
  -- Get budget limit from workspace settings (placeholder)
  v_budget_limit := 500.00; -- Default, should come from settings
  
  FOR v_alert IN 
    SELECT * FROM budget_alerts 
    WHERE workspace_id = p_workspace_id AND is_active = TRUE
  LOOP
    IF v_alert.threshold_type = 'percentage' THEN
      v_percentage := (v_current_usage / v_budget_limit) * 100;
      v_should_notify := v_percentage >= v_alert.threshold_value;
    ELSE
      v_should_notify := v_current_usage >= v_alert.threshold_value;
    END IF;
    
    -- Check cooldown
    IF v_should_notify AND v_alert.last_notification_at IS NOT NULL THEN
      IF v_alert.last_notification_at + (v_alert.cooldown_hours || ' hours')::INTERVAL > NOW() THEN
        v_should_notify := FALSE;
      END IF;
    END IF;
    
    IF v_should_notify THEN
      RETURN QUERY SELECT 
        v_alert.id,
        TRUE,
        format('Budget alert: %s%% of monthly budget used ($%s of $%s)', 
          round(v_percentage, 1), round(v_current_usage, 2), round(v_budget_limit, 2));
    END IF;
  END LOOP;
END;
$_$;


--
-- Name: cleanup_expired_reports(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_reports() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM compliance_reports
  WHERE expires_at < now();
END;
$$;


--
-- Name: create_ad_creative_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_ad_creative_version() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_version_number INTEGER;
BEGIN
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version_number
  FROM ad_creative_versions WHERE creative_id = NEW.id;
  
  -- Create version record
  INSERT INTO ad_creative_versions (creative_id, version_number, changes, snapshot, created_by)
  VALUES (
    NEW.id,
    v_version_number,
    jsonb_build_object(
      'changed_at', now(),
      'changed_fields', (
        SELECT jsonb_object_agg(key, value)
        FROM jsonb_each(to_jsonb(NEW))
        WHERE key NOT IN ('id', 'created_at', 'updated_at', 'created_by', 'workspace_id')
        AND to_jsonb(NEW) -> key IS DISTINCT FROM to_jsonb(OLD) -> key
      )
    ),
    to_jsonb(NEW),
    NEW.created_by
  );
  
  RETURN NEW;
END;
$$;


--
-- Name: create_campaign_version(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_campaign_version(p_campaign_id uuid, p_description text DEFAULT NULL::text, p_change_type text DEFAULT 'content'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_campaign RECORD;
  v_new_version_number INT;
  v_new_version_id UUID;
  v_prev_snapshot JSONB;
BEGIN
  -- Get campaign
  SELECT * INTO v_campaign FROM campaigns WHERE id = p_campaign_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found: %', p_campaign_id;
  END IF;
  
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_new_version_number
  FROM campaign_versions
  WHERE campaign_id = p_campaign_id;
  
  -- Get previous snapshot for diff
  SELECT snapshot INTO v_prev_snapshot
  FROM campaign_versions
  WHERE campaign_id = p_campaign_id AND is_current = TRUE;
  
  -- Unset current flag on previous version
  UPDATE campaign_versions
  SET is_current = FALSE
  WHERE campaign_id = p_campaign_id AND is_current = TRUE;
  
  -- Create new version
  INSERT INTO campaign_versions (
    campaign_id,
    workspace_id,
    version_number,
    snapshot,
    diff_from_previous,
    description,
    change_type,
    is_current,
    created_by
  )
  VALUES (
    p_campaign_id,
    v_campaign.workspace_id,
    v_new_version_number,
    to_jsonb(v_campaign),
    NULL, -- Diff calculation can be done async
    p_description,
    p_change_type,
    TRUE,
    auth.uid()
  )
  RETURNING id INTO v_new_version_id;
  
  -- Update campaign version info
  UPDATE campaigns
  SET current_version = v_new_version_number,
      version_count = v_new_version_number
  WHERE id = p_campaign_id;
  
  RETURN v_new_version_id;
END;
$$;


--
-- Name: create_canvas_version(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_canvas_version(p_canvas_id uuid, p_description text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_canvas RECORD;
  v_new_version INT;
  v_version_id UUID;
BEGIN
  SELECT * INTO v_canvas FROM canvases WHERE id = p_canvas_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Canvas not found: %', p_canvas_id;
  END IF;
  
  -- Get next version
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_new_version
  FROM canvas_versions WHERE canvas_id = p_canvas_id;
  
  -- Create version
  INSERT INTO canvas_versions (canvas_id, version_number, elements_snapshot, description, created_by)
  VALUES (p_canvas_id, v_new_version, v_canvas.elements, p_description, auth.uid())
  RETURNING id INTO v_version_id;
  
  -- Update canvas version
  UPDATE canvases SET version = v_new_version WHERE id = p_canvas_id;
  
  RETURN v_version_id;
END;
$$;


--
-- Name: create_default_subscription(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_default_subscription() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO subscriptions (workspace_id, plan_id, status)
  VALUES (NEW.id, 'free', 'active');
  RETURN NEW;
END;
$$;


--
-- Name: debit_wallet(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.debit_wallet(p_workspace_id uuid, p_amount integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_balance integer;
  v_new_balance integer;
BEGIN
  -- Get current balance with row lock
  SELECT balance INTO v_balance
  FROM workspace_wallets
  WHERE workspace_id = p_workspace_id
  FOR UPDATE;
  
  -- Check if wallet exists
  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  -- Check sufficient balance
  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Debit
  v_new_balance := v_balance - p_amount;
  
  UPDATE workspace_wallets
  SET balance = v_new_balance, updated_at = now()
  WHERE workspace_id = p_workspace_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'previous_balance', v_balance,
    'new_balance', v_new_balance
  );
END;
$$;


--
-- Name: generate_affiliate_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_affiliate_code() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  code TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN code;
END;
$$;


--
-- Name: generate_campaign_tracking_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_campaign_tracking_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.tracking_id IS NULL THEN
    NEW.tracking_id := 'sako_' || SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 12);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: get_claim_performance_summary(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_claim_performance_summary(p_claim_id uuid) RETURNS TABLE(total_impressions bigint, total_clicks bigint, total_conversions bigint, avg_ctr numeric, avg_conversion_rate numeric, performance_score numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    SUM(impressions)::BIGINT as total_impressions,
    SUM(clicks)::BIGINT as total_clicks,
    SUM(conversions)::BIGINT as total_conversions,
    AVG(ctr) as avg_ctr,
    AVG(conversion_rate) as avg_conversion_rate,
    -- Performance score: weighted combination of CTR and conversion rate
    (AVG(ctr) * 0.3 + AVG(conversion_rate) * 0.7) * 100 as performance_score
  FROM claim_performance
  WHERE claim_id = p_claim_id;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    tagline text,
    description text,
    website_url text,
    logo_primary_url text,
    logo_primary_dark_url text,
    logo_icon_url text,
    favicon_url text,
    primary_color text DEFAULT '#6366f1'::text NOT NULL,
    secondary_color text DEFAULT '#8b5cf6'::text,
    accent_color text,
    background_color text DEFAULT '#0f0f0f'::text,
    text_color text DEFAULT '#ffffff'::text,
    color_palette jsonb DEFAULT '[]'::jsonb,
    gradients jsonb DEFAULT '[]'::jsonb,
    font_family text DEFAULT 'Inter'::text,
    font_heading text,
    font_mono text,
    font_weights jsonb DEFAULT '["400", "500", "600", "700"]'::jsonb,
    font_cdn_url text,
    voice text,
    tone_attributes jsonb DEFAULT '[]'::jsonb,
    key_messages jsonb DEFAULT '[]'::jsonb,
    value_propositions jsonb DEFAULT '[]'::jsonb,
    boilerplate text,
    visual_style jsonb DEFAULT '{}'::jsonb,
    icon_style text DEFAULT 'lucide'::text,
    image_style text,
    guidelines_url text,
    dos jsonb DEFAULT '[]'::jsonb,
    donts jsonb DEFAULT '[]'::jsonb,
    social_links jsonb DEFAULT '{}'::jsonb,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    color_usage_rules jsonb DEFAULT '{}'::jsonb,
    forbidden_imagery text[] DEFAULT '{}'::text[],
    mood_keywords text[] DEFAULT '{}'::text[],
    logo_usage_rules jsonb DEFAULT '{}'::jsonb,
    typography_rules jsonb DEFAULT '{}'::jsonb,
    image_examples text[] DEFAULT '{}'::text[],
    style_references text[] DEFAULT '{}'::text[]
);


--
-- Name: get_default_brand(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_default_brand(p_workspace_id uuid) RETURNS public.brands
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    SELECT * FROM brands 
    WHERE workspace_id = p_workspace_id 
    AND is_default = true
    LIMIT 1
  );
END;
$$;


--
-- Name: get_memory_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_memory_stats(p_workspace_id uuid) RETURNS TABLE(total_items bigint, approved_items bigint, rejected_items bigint, avg_feedback_score double precision, items_by_type jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT AS total_items,
    COUNT(*) FILTER (WHERE status = 'approved')::BIGINT AS approved_items,
    COUNT(*) FILTER (WHERE status = 'rejected')::BIGINT AS rejected_items,
    AVG(feedback_score)::FLOAT AS avg_feedback_score,
    jsonb_object_agg(content_type, type_count) AS items_by_type
  FROM (
    SELECT 
      status,
      feedback_score,
      content_type,
      COUNT(*) AS type_count
    FROM memory_items
    WHERE workspace_id = p_workspace_id
    GROUP BY status, feedback_score, content_type
  ) sub
  GROUP BY TRUE;
END;
$$;


--
-- Name: get_top_performing_claims(uuid, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_top_performing_claims(p_workspace_id uuid, p_limit integer DEFAULT 10, p_min_impressions integer DEFAULT 100, p_category text DEFAULT NULL::text) RETURNS TABLE(claim_text text, conversion_rate numeric, performance_score integer, impressions integer, conversions integer, confidence_level text, category text)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cp.claim_text,
    cp.conversion_rate,
    cp.performance_score,
    cp.impressions,
    cp.conversions,
    cp.confidence_level,
    cp.category
  FROM claim_performance cp
  WHERE cp.workspace_id = p_workspace_id
    AND cp.impressions >= p_min_impressions
    AND (p_category IS NULL OR cp.category = p_category)
  ORDER BY cp.performance_score DESC, cp.conversion_rate DESC
  LIMIT p_limit;
END;
$$;


--
-- Name: increment_app_run_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_app_run_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE studio_apps 
  SET run_count = run_count + 1, last_run_at = NOW()
  WHERE id = NEW.app_id;
  RETURN NEW;
END;
$$;


--
-- Name: increment_component_usage(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_component_usage(component_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE ui_components
  SET usage_count = usage_count + 1
  WHERE id = component_id;
END;
$$;


--
-- Name: increment_design_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_design_version() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.version := COALESCE(OLD.version, 0) + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: increment_gallery_view(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_gallery_view(p_campaign_id uuid, p_workspace_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Update view count
  UPDATE public_campaigns SET view_count = view_count + 1 WHERE id = p_campaign_id;
  
  -- Record interaction (ignore if already viewed today)
  INSERT INTO gallery_interactions (public_campaign_id, workspace_id, interaction_type)
  VALUES (p_campaign_id, p_workspace_id, 'view')
  ON CONFLICT (public_campaign_id, workspace_id, interaction_type) DO NOTHING;
END;
$$;


--
-- Name: increment_knowledge_reference(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_knowledge_reference(p_item_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE knowledge_items 
  SET reference_count = reference_count + 1, last_referenced_at = NOW()
  WHERE id = p_item_id;
END;
$$;


--
-- Name: increment_newsletter_template_usage(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_newsletter_template_usage(template_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE newsletter_templates SET usage_count = usage_count + 1 WHERE id = template_id;
END;
$$;


--
-- Name: increment_page_view(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_page_view(page_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE published_pages
  SET view_count = view_count + 1,
      last_viewed_at = now()
  WHERE id = page_id;
END;
$$;


--
-- Name: increment_report_views(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_report_views(report_token text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE compliance_reports
  SET view_count = view_count + 1
  WHERE token = report_token
    AND is_public = true
    AND expires_at > now();
END;
$$;


--
-- Name: increment_site_views(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_site_views(site_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE published_sites
  SET view_count = view_count + 1
  WHERE id = site_id;
END;
$$;


--
-- Name: increment_snippet_usage(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_snippet_usage(snippet_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE snippets SET usage_count = usage_count + 1 WHERE id = snippet_id;
END;
$$;


--
-- Name: increment_template_remix_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_template_remix_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.original_template_id IS NOT NULL THEN
    UPDATE design_templates 
    SET remix_count = remix_count + 1 
    WHERE id = NEW.original_template_id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: increment_template_usage(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_template_usage(template_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE templates
  SET usage_count = usage_count + 1
  WHERE id = template_id;
END;
$$;


--
-- Name: increment_usage_metric(uuid, text, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_usage_metric(p_workspace_id uuid, p_metric_type text, p_period_start date DEFAULT CURRENT_DATE, p_period_end date DEFAULT ((date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone) + '1 mon -1 days'::interval))::date) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO usage_metrics (workspace_id, metric_type, count, period_start, period_end)
  VALUES (p_workspace_id, p_metric_type, 1, p_period_start, p_period_end)
  ON CONFLICT (workspace_id, metric_type, period_start)
  DO UPDATE SET count = usage_metrics.count + 1;
END;
$$;


--
-- Name: is_workspace_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_workspace_admin(p_workspace_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id
    AND user_id = auth.uid()
    AND role IN ('admin', 'owner')
  );
$$;


--
-- Name: queue_zapier_webhook(text, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.queue_zapier_webhook(p_trigger_type text, p_workspace_id uuid, p_payload jsonb) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_subscription RECORD;
  v_count INT := 0;
BEGIN
  FOR v_subscription IN 
    SELECT * FROM zapier_webhook_subscriptions
    WHERE workspace_id = p_workspace_id
    AND trigger_type = p_trigger_type
    AND is_active = TRUE
  LOOP
    INSERT INTO zapier_webhook_deliveries (subscription_id, payload)
    VALUES (v_subscription.id, p_payload);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;


--
-- Name: record_claim_conversion(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_claim_conversion(p_workspace_id uuid, p_claim_hash text, p_campaign_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE claim_performance
  SET 
    conversions = conversions + 1,
    last_conversion_at = NOW(),
    updated_at = NOW(),
    -- Update confidence based on sample size
    confidence_level = CASE
      WHEN impressions >= 1000 THEN 'high'
      WHEN impressions >= 100 THEN 'medium'
      ELSE 'low'
    END,
    -- Recalculate performance score
    performance_score = CASE
      WHEN impressions >= 50 THEN 
        LEAST(100, GREATEST(0, 
          50 + (((conversions + 1)::decimal / GREATEST(impressions, 1)) * 100)::integer
        ))
      ELSE 50 -- Not enough data
    END
  WHERE claim_hash = p_claim_hash AND workspace_id = p_workspace_id;
END;
$$;


--
-- Name: record_claim_impression(uuid, text, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_claim_impression(p_workspace_id uuid, p_claim_hash text, p_claim_text text, p_campaign_id uuid DEFAULT NULL::uuid, p_category text DEFAULT 'generic'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO claim_performance (
    workspace_id, claim_hash, claim_text, campaign_id, category,
    impressions, last_impression_at
  )
  VALUES (
    p_workspace_id, p_claim_hash, p_claim_text, p_campaign_id, p_category,
    1, NOW()
  )
  ON CONFLICT (claim_hash, workspace_id)
  DO UPDATE SET
    impressions = claim_performance.impressions + 1,
    last_impression_at = NOW(),
    updated_at = NOW(),
    -- Update campaign_id if provided and not already set
    campaign_id = COALESCE(claim_performance.campaign_id, EXCLUDED.campaign_id);
END;
$$;


--
-- Name: record_composer_feedback(uuid, uuid, uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_composer_feedback(p_workspace_id uuid, p_campaign_id uuid, p_sako_task_id uuid, p_event_type text, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_feedback_id UUID;
BEGIN
  INSERT INTO composer_feedback_events (
    workspace_id,
    campaign_id,
    sako_task_id,
    event_type,
    metadata,
    created_at
  ) VALUES (
    p_workspace_id,
    p_campaign_id,
    p_sako_task_id,
    p_event_type,
    p_metadata,
    now()
  )
  RETURNING id INTO v_feedback_id;
  
  RETURN v_feedback_id;
END;
$$;


--
-- Name: record_share_view(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_share_view(p_token text, p_viewer_ip text DEFAULT NULL::text, p_viewer_email text DEFAULT NULL::text, p_session_id text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_share_token RECORD;
  v_view_count INT;
BEGIN
  -- Get share token
  SELECT * INTO v_share_token FROM share_tokens WHERE token = p_token;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Token not found', 'allowed', FALSE);
  END IF;
  
  -- Check if active
  IF NOT v_share_token.is_active THEN
    RETURN jsonb_build_object('error', 'Link is no longer active', 'allowed', FALSE);
  END IF;
  
  -- Check expiration
  IF v_share_token.expires_at IS NOT NULL AND v_share_token.expires_at < NOW() THEN
    RETURN jsonb_build_object('error', 'Link has expired', 'allowed', FALSE);
  END IF;
  
  -- Check view limit
  IF v_share_token.max_views IS NOT NULL THEN
    SELECT COUNT(*) INTO v_view_count FROM share_views WHERE share_token_id = v_share_token.id;
    IF v_view_count >= v_share_token.max_views THEN
      RETURN jsonb_build_object('error', 'View limit reached', 'allowed', FALSE);
    END IF;
  END IF;
  
  -- Check email restriction
  IF array_length(v_share_token.allowed_emails, 1) > 0 THEN
    IF p_viewer_email IS NULL OR NOT (p_viewer_email = ANY(v_share_token.allowed_emails)) THEN
      RETURN jsonb_build_object('error', 'Access restricted', 'allowed', FALSE, 'requires_email', TRUE);
    END IF;
  END IF;
  
  -- Record view if tracking enabled
  IF v_share_token.view_tracking THEN
    INSERT INTO share_views (share_token_id, viewer_ip, viewer_email, session_id)
    VALUES (v_share_token.id, p_viewer_ip, p_viewer_email, p_session_id);
  END IF;
  
  -- Update last viewed
  UPDATE share_tokens SET last_viewed_at = NOW() WHERE id = v_share_token.id;
  
  RETURN jsonb_build_object(
    'allowed', TRUE,
    'campaign_id', v_share_token.campaign_id,
    'settings', jsonb_build_object(
      'show_claims', v_share_token.show_claims,
      'show_evidence', v_share_token.show_evidence,
      'show_analytics', v_share_token.show_analytics,
      'allow_comments', v_share_token.allow_comments,
      'custom_title', v_share_token.custom_title,
      'custom_message', v_share_token.custom_message,
      'hide_branding', v_share_token.hide_sako_branding,
      'collect_email', v_share_token.collect_email
    )
  );
END;
$$;


--
-- Name: record_webhook_failure(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_webhook_failure(webhook_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE webhook_configurations 
  SET failure_count = failure_count + 1
  WHERE id = webhook_id;
END;
$$;


--
-- Name: record_webhook_trigger(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_webhook_trigger(webhook_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE webhook_configurations 
  SET 
    last_triggered_at = now(),
    trigger_count = trigger_count + 1
  WHERE id = webhook_id;
END;
$$;


--
-- Name: restore_campaign_version(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.restore_campaign_version(p_campaign_id uuid, p_version_number integer) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_version RECORD;
  v_restored_id UUID;
BEGIN
  -- Get version to restore
  SELECT * INTO v_version
  FROM campaign_versions
  WHERE campaign_id = p_campaign_id AND version_number = p_version_number;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version % not found for campaign %', p_version_number, p_campaign_id;
  END IF;
  
  -- Update campaign with snapshot data
  UPDATE campaigns
  SET 
    name = (v_version.snapshot->>'name'),
    audience = (v_version.snapshot->>'audience'),
    goal = (v_version.snapshot->>'goal'),
    offer = (v_version.snapshot->>'offer'),
    cta = (v_version.snapshot->>'cta'),
    status = 'draft', -- Reset to draft when restoring
    updated_at = NOW()
  WHERE id = p_campaign_id;
  
  -- Create new version to record the restoration
  SELECT create_campaign_version(
    p_campaign_id,
    format('Restored from version %s', p_version_number),
    'major'
  ) INTO v_restored_id;
  
  -- Mark restoration source
  UPDATE campaign_versions
  SET restored_from_version = p_version_number
  WHERE id = v_restored_id;
  
  RETURN v_restored_id;
END;
$$;


--
-- Name: search_knowledge(uuid, public.vector, double precision, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_knowledge(p_workspace_id uuid, p_query_embedding public.vector, p_match_threshold double precision DEFAULT 0.7, p_match_count integer DEFAULT 10) RETURNS TABLE(id uuid, title text, content text, content_type text, similarity double precision)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ki.id,
    ki.title,
    ki.content,
    ki.content_type,
    1 - (ki.embedding <=> p_query_embedding) as similarity
  FROM knowledge_items ki
  WHERE ki.workspace_id = p_workspace_id
    AND ki.status = 'active'
    AND ki.embedding IS NOT NULL
    AND 1 - (ki.embedding <=> p_query_embedding) > p_match_threshold
  ORDER BY ki.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;


--
-- Name: search_memory_by_embedding(uuid, public.vector, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_memory_by_embedding(p_workspace_id uuid, p_embedding public.vector, p_content_type text DEFAULT NULL::text, p_limit integer DEFAULT 10) RETURNS TABLE(id uuid, content text, content_type text, status text, feedback_score integer, similarity double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.content,
    m.content_type,
    m.status,
    m.feedback_score,
    1 - (m.embedding <=> p_embedding) AS similarity
  FROM memory_items m
  WHERE 
    m.workspace_id = p_workspace_id
    AND m.embedding IS NOT NULL
    AND (p_content_type IS NULL OR m.content_type = p_content_type)
  ORDER BY m.embedding <=> p_embedding
  LIMIT p_limit;
END;
$$;


--
-- Name: search_templates(public.vector, text, text, text, text[], integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_templates(query_embedding public.vector, category_filter text DEFAULT NULL::text, theme_filter text DEFAULT NULL::text, layout_filter text DEFAULT NULL::text, industry_filter text[] DEFAULT NULL::text[], top_k integer DEFAULT 5) RETURNS TABLE(id uuid, section_id text, template_name text, category text, industry text[], visual_style jsonb, design_tokens jsonb, html text, description text, similarity double precision)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dt.id,
    dt.section_id,
    dt.template_name,
    dt.category,
    dt.industry,
    dt.visual_style,
    dt.design_tokens,
    dt.html,
    dt.description,
    1 - (dt.embedding <=> query_embedding) AS similarity
  FROM design_templates dt
  WHERE 
    (category_filter IS NULL OR dt.category = category_filter)
    AND (theme_filter IS NULL OR dt.visual_style->>'theme' = theme_filter)
    AND (layout_filter IS NULL OR dt.visual_style->>'layout' = layout_filter)
    AND (industry_filter IS NULL OR dt.industry && industry_filter)
  ORDER BY dt.embedding <=> query_embedding
  LIMIT top_k;
END;
$$;


--
-- Name: search_templates_ranked(public.vector, text, text, text[], integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_templates_ranked(query_embedding public.vector, category_filter text DEFAULT NULL::text, theme_filter text DEFAULT NULL::text, industry_filter text[] DEFAULT NULL::text[], top_k integer DEFAULT 5) RETURNS TABLE(id uuid, section_id text, template_name text, category text, visual_style jsonb, html text, description text, similarity double precision, quality_score double precision, final_score double precision)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dt.id,
    dt.section_id,
    dt.template_name,
    dt.category,
    dt.visual_style,
    dt.html,
    dt.description,
    1 - (dt.embedding <=> query_embedding) AS similarity,
    dt.quality_score,
    -- Combined score: 70% similarity, 30% quality
    (0.7 * (1 - (dt.embedding <=> query_embedding))) + (0.3 * dt.quality_score) AS final_score
  FROM design_templates dt
  WHERE 
    dt.embedding IS NOT NULL
    AND (category_filter IS NULL OR dt.category = category_filter)
    AND (theme_filter IS NULL OR dt.visual_style->>'theme' = theme_filter)
    AND (industry_filter IS NULL OR dt.suitable_for && industry_filter)
  ORDER BY final_score DESC
  LIMIT top_k;
END;
$$;


--
-- Name: toggle_gallery_like(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_gallery_like(p_campaign_id uuid, p_workspace_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM gallery_interactions 
    WHERE public_campaign_id = p_campaign_id 
    AND workspace_id = p_workspace_id 
    AND interaction_type = 'like'
  ) INTO v_exists;
  
  IF v_exists THEN
    DELETE FROM gallery_interactions 
    WHERE public_campaign_id = p_campaign_id 
    AND workspace_id = p_workspace_id 
    AND interaction_type = 'like';
    
    UPDATE public_campaigns SET like_count = like_count - 1 WHERE id = p_campaign_id;
    RETURN FALSE;
  ELSE
    INSERT INTO gallery_interactions (public_campaign_id, workspace_id, interaction_type)
    VALUES (p_campaign_id, p_workspace_id, 'like');
    
    UPDATE public_campaigns SET like_count = like_count + 1 WHERE id = p_campaign_id;
    RETURN TRUE;
  END IF;
END;
$$;


--
-- Name: track_usage_event(uuid, text, text, text, integer, integer, double precision, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.track_usage_event(p_workspace_id uuid, p_user_id text, p_event_type text, p_event_subtype text DEFAULT NULL::text, p_units integer DEFAULT 1, p_tokens integer DEFAULT NULL::integer, p_cost double precision DEFAULT NULL::double precision, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_event_id UUID;
  v_period_start DATE;
BEGIN
  -- Insert event
  INSERT INTO usage_events (workspace_id, user_id, event_type, event_subtype, units_consumed, tokens_used, cost_usd, metadata)
  VALUES (p_workspace_id, p_user_id, p_event_type, p_event_subtype, p_units, p_tokens, p_cost, p_metadata)
  RETURNING id INTO v_event_id;
  
  -- Get current period start (first of month)
  v_period_start := date_trunc('month', CURRENT_DATE)::DATE;
  
  -- Update or insert aggregate
  INSERT INTO usage_aggregates (workspace_id, period_start, period_end, ai_generations, ai_tokens_used, deployments, api_calls, exports, sako_tasks, total_cost_usd)
  VALUES (
    p_workspace_id,
    v_period_start,
    (v_period_start + INTERVAL '1 month - 1 day')::DATE,
    CASE WHEN p_event_type = 'ai_generation' THEN p_units ELSE 0 END,
    COALESCE(p_tokens, 0),
    CASE WHEN p_event_type = 'deployment' THEN p_units ELSE 0 END,
    CASE WHEN p_event_type = 'api_call' THEN p_units ELSE 0 END,
    CASE WHEN p_event_type = 'export' THEN p_units ELSE 0 END,
    CASE WHEN p_event_type = 'sako_task' THEN p_units ELSE 0 END,
    COALESCE(p_cost, 0)
  )
  ON CONFLICT (workspace_id, period_start) DO UPDATE SET
    ai_generations = usage_aggregates.ai_generations + CASE WHEN p_event_type = 'ai_generation' THEN p_units ELSE 0 END,
    ai_tokens_used = usage_aggregates.ai_tokens_used + COALESCE(p_tokens, 0),
    deployments = usage_aggregates.deployments + CASE WHEN p_event_type = 'deployment' THEN p_units ELSE 0 END,
    api_calls = usage_aggregates.api_calls + CASE WHEN p_event_type = 'api_call' THEN p_units ELSE 0 END,
    exports = usage_aggregates.exports + CASE WHEN p_event_type = 'export' THEN p_units ELSE 0 END,
    sako_tasks = usage_aggregates.sako_tasks + CASE WHEN p_event_type = 'sako_task' THEN p_units ELSE 0 END,
    total_cost_usd = usage_aggregates.total_cost_usd + COALESCE(p_cost, 0),
    updated_at = NOW();
  
  RETURN v_event_id;
END;
$$;


--
-- Name: update_ad_format_configs_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_ad_format_configs_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_affiliate_earnings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_affiliate_earnings() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    UPDATE affiliates
    SET 
      pending_earnings = pending_earnings + NEW.commission_amount,
      total_earnings = total_earnings + NEW.commission_amount,
      updated_at = now()
    WHERE id = NEW.affiliate_id;
  ELSIF NEW.status = 'paid' AND OLD.status = 'cleared' THEN
    UPDATE affiliates
    SET 
      pending_earnings = pending_earnings - NEW.commission_amount,
      paid_earnings = paid_earnings + NEW.commission_amount,
      updated_at = now()
    WHERE id = NEW.affiliate_id;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_affiliate_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_affiliate_stats() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Update referral counts
  UPDATE affiliates
  SET 
    total_referrals = (
      SELECT COUNT(*) FROM affiliate_referrals 
      WHERE affiliate_id = NEW.affiliate_id
    ),
    active_referrals = (
      SELECT COUNT(*) FROM affiliate_referrals 
      WHERE affiliate_id = NEW.affiliate_id 
      AND status = 'subscribed'
    ),
    updated_at = now()
  WHERE id = NEW.affiliate_id;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_api_key_last_used(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_api_key_last_used() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE api_keys SET last_used_at = NOW() WHERE id = NEW.api_key_id;
  RETURN NEW;
END;
$$;


--
-- Name: update_approval_templates_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_approval_templates_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_asset_comments_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_asset_comments_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_asset_documents_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_asset_documents_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_audiences_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_audiences_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_bigquery_sync_configs_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_bigquery_sync_configs_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_brand_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_brand_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_calendar_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_calendar_stats() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE social_calendars
  SET 
    total_posts = (
      SELECT COUNT(*) FROM social_posts 
      WHERE calendar_id = COALESCE(NEW.calendar_id, OLD.calendar_id)
    ),
    scheduled_posts = (
      SELECT COUNT(*) FROM social_posts 
      WHERE calendar_id = COALESCE(NEW.calendar_id, OLD.calendar_id)
      AND status = 'scheduled'
    ),
    published_posts = (
      SELECT COUNT(*) FROM social_posts 
      WHERE calendar_id = COALESCE(NEW.calendar_id, OLD.calendar_id)
      AND status = 'published'
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.calendar_id, OLD.calendar_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: update_canvas_elements_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_canvas_elements_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  -- Also update parent canvas
  UPDATE canvases SET updated_at = NOW() WHERE id = NEW.canvas_id;
  RETURN NEW;
END;
$$;


--
-- Name: update_canvases_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_canvases_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_edited_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_chat_session_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_chat_session_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE chat_sessions SET updated_at = now() WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;


--
-- Name: update_chat_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_chat_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE private_chats
  SET updated_at = now()
  WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$;


--
-- Name: update_content_ideas_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_content_ideas_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_feedback_cycle_time(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_feedback_cycle_time() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_created_at TIMESTAMPTZ;
BEGIN
  -- Only run on status change to completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Get the task creation time from feedback events
    SELECT created_at INTO v_created_at
    FROM composer_feedback_events
    WHERE sako_task_id = NEW.id AND event_type = 'task_created'
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- Update or create completion feedback event with cycle time
    IF v_created_at IS NOT NULL THEN
      UPDATE composer_feedback_events
      SET 
        cycle_time_seconds = EXTRACT(EPOCH FROM (now() - v_created_at))::INTEGER,
        event_type = 'task_completed'
      WHERE sako_task_id = NEW.id 
        AND event_type = 'task_completed'
        AND created_at > now() - interval '1 second'; -- Recent event
      
      -- If no recent completion event, the trigger will have created one
      IF NOT FOUND THEN
        INSERT INTO composer_feedback_events (
          workspace_id,
          campaign_id,
          sako_task_id,
          event_type,
          cycle_time_seconds
        ) VALUES (
          NEW.workspace_id,
          NEW.campaign_id,
          NEW.id,
          'task_completed',
          EXTRACT(EPOCH FROM (now() - v_created_at))::INTEGER
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_generated_images_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_generated_images_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_knowledge_items_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_knowledge_items_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_launch_kits_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_launch_kits_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_marketplace_templates_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_marketplace_templates_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_memory_items_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_memory_items_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_newsletter_templates_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_newsletter_templates_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_project_pages_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_project_pages_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_projects_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_projects_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_provider_health_summary(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_provider_health_summary() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO provider_health_summary (workspace_id, provider_type, current_status, last_check_at)
  VALUES (NEW.workspace_id, NEW.provider_type, NEW.status, NEW.checked_at)
  ON CONFLICT (workspace_id, provider_type) DO UPDATE SET
    current_status = NEW.status,
    last_check_at = NEW.checked_at,
    last_healthy_at = CASE WHEN NEW.status = 'healthy' THEN NEW.checked_at ELSE provider_health_summary.last_healthy_at END,
    last_error_at = CASE WHEN NEW.status = 'unhealthy' THEN NEW.checked_at ELSE provider_health_summary.last_error_at END,
    last_error_message = CASE WHEN NEW.status = 'unhealthy' THEN NEW.error_message ELSE provider_health_summary.last_error_message END,
    avg_response_time_ms = (COALESCE(provider_health_summary.avg_response_time_ms, NEW.response_time_ms) + NEW.response_time_ms) / 2,
    error_count_24h = CASE 
      WHEN NEW.status = 'unhealthy' THEN provider_health_summary.error_count_24h + 1 
      ELSE provider_health_summary.error_count_24h 
    END,
    updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_public_campaigns_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_public_campaigns_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_requests_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_requests_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  -- Also update completed_at if status changed to done
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: update_saved_ad_creatives_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_saved_ad_creatives_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_saved_newsletters_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_saved_newsletters_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_snippets_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_snippets_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_studio_apps_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_studio_apps_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_template_quality_score(uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_template_quality_score(p_template_id uuid, p_outcome text, p_edit_distance integer DEFAULT NULL::integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_current_score FLOAT;
  v_delta FLOAT;
  v_new_score FLOAT;
BEGIN
  -- Get current score
  SELECT quality_score INTO v_current_score
  FROM design_templates
  WHERE id = p_template_id;
  
  -- Calculate delta based on outcome
  CASE p_outcome
    WHEN 'accepted' THEN v_delta := 0.05;
    WHEN 'edited' THEN 
      -- Smaller boost for edited, scaled by edit distance
      IF p_edit_distance IS NOT NULL AND p_edit_distance < 500 THEN
        v_delta := 0.03;
      ELSE
        v_delta := 0.01;
      END IF;
    WHEN 'rejected' THEN v_delta := -0.03;
    ELSE v_delta := 0;
  END CASE;
  
  -- Calculate new score (clamped to 0-1)
  v_new_score := GREATEST(0, LEAST(1, v_current_score + v_delta));
  
  -- Update template
  UPDATE design_templates
  SET 
    quality_score = v_new_score,
    times_used = times_used + 1,
    times_accepted = CASE WHEN p_outcome = 'accepted' THEN times_accepted + 1 ELSE times_accepted END,
    times_edited = CASE WHEN p_outcome = 'edited' THEN times_edited + 1 ELSE times_edited END,
    times_rejected = CASE WHEN p_outcome = 'rejected' THEN times_rejected + 1 ELSE times_rejected END,
    avg_edit_distance = CASE 
      WHEN p_edit_distance IS NOT NULL THEN 
        (avg_edit_distance * times_used + p_edit_distance) / (times_used + 1)
      ELSE avg_edit_distance
    END,
    updated_at = NOW()
  WHERE id = p_template_id;
  
  -- Update daily analytics
  INSERT INTO section_analytics (template_id, date, times_accepted, times_edited, times_rejected, avg_edit_distance)
  VALUES (
    p_template_id, 
    CURRENT_DATE,
    CASE WHEN p_outcome = 'accepted' THEN 1 ELSE 0 END,
    CASE WHEN p_outcome = 'edited' THEN 1 ELSE 0 END,
    CASE WHEN p_outcome = 'rejected' THEN 1 ELSE 0 END,
    p_edit_distance
  )
  ON CONFLICT (template_id, date) DO UPDATE SET
    times_accepted = section_analytics.times_accepted + CASE WHEN p_outcome = 'accepted' THEN 1 ELSE 0 END,
    times_edited = section_analytics.times_edited + CASE WHEN p_outcome = 'edited' THEN 1 ELSE 0 END,
    times_rejected = section_analytics.times_rejected + CASE WHEN p_outcome = 'rejected' THEN 1 ELSE 0 END,
    avg_edit_distance = CASE 
      WHEN p_edit_distance IS NOT NULL THEN 
        (COALESCE(section_analytics.avg_edit_distance, 0) * (section_analytics.times_accepted + section_analytics.times_edited + section_analytics.times_rejected) + p_edit_distance) / 
        (section_analytics.times_accepted + section_analytics.times_edited + section_analytics.times_rejected + 1)
      ELSE section_analytics.avg_edit_distance
    END;
END;
$$;


--
-- Name: update_template_rating(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_template_rating() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE marketplace_templates
  SET 
    rating_avg = (SELECT AVG(rating)::DECIMAL(3,2) FROM template_reviews WHERE template_id = NEW.template_id AND is_visible = TRUE),
    rating_count = (SELECT COUNT(*) FROM template_reviews WHERE template_id = NEW.template_id AND is_visible = TRUE)
  WHERE id = NEW.template_id;
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_webhook_configurations_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_webhook_configurations_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_workflow_run_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_workflow_run_stats() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.status IN ('completed', 'failed') AND OLD.status NOT IN ('completed', 'failed') THEN
    UPDATE workflows
    SET 
      run_count = run_count + 1,
      success_count = success_count + CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
      failure_count = failure_count + CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
      last_run_at = NEW.completed_at,
      avg_duration_ms = CASE 
        WHEN avg_duration_ms IS NULL THEN NEW.duration_ms
        ELSE (avg_duration_ms + NEW.duration_ms) / 2
      END
    WHERE id = NEW.workflow_id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: update_workflows_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_workflows_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: user_has_purchased_template(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_has_purchased_template(p_user_id uuid, p_template_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM template_purchases 
    WHERE user_id = p_user_id 
    AND template_id = p_template_id 
    AND status = 'completed'
  );
END;
$$;


--
-- Name: ad_ab_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_ab_tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    variant_a_id uuid NOT NULL,
    variant_b_id uuid NOT NULL,
    test_metric text DEFAULT 'ctr'::text,
    budget_cents integer,
    status text DEFAULT 'pending'::text,
    winner_id uuid,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    results jsonb DEFAULT '{}'::jsonb,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ad_creative_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_creative_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    creative_id uuid NOT NULL,
    version_number integer NOT NULL,
    changes jsonb NOT NULL,
    snapshot jsonb NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ad_creatives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_creatives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    campaign_id uuid,
    platform text NOT NULL,
    format text NOT NULL,
    primary_text text,
    headline text,
    description text,
    call_to_action text,
    hook text,
    slides jsonb,
    script jsonb,
    cards jsonb,
    image_prompts text[],
    dimensions jsonb,
    duration integer,
    hashtags text[],
    archetype text,
    variant_label text,
    claims text[],
    status text DEFAULT 'draft'::text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ad_creatives_format_check CHECK ((format = ANY (ARRAY['story'::text, 'reels'::text, 'carousel'::text, 'feed'::text, 'video'::text]))),
    CONSTRAINT ad_creatives_platform_check CHECK ((platform = ANY (ARRAY['instagram'::text, 'facebook'::text, 'tiktok'::text]))),
    CONSTRAINT ad_creatives_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: ad_format_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_format_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    platform text NOT NULL,
    format text NOT NULL,
    name text NOT NULL,
    dimensions jsonb NOT NULL,
    aspect_ratio text,
    duration_range jsonb,
    file_types text[] DEFAULT '{}'::text[],
    max_file_size_mb integer,
    text_limits jsonb DEFAULT '{}'::jsonb,
    best_practices text[],
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: affiliate_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    type text NOT NULL,
    category text,
    file_url text NOT NULL,
    thumbnail_url text,
    dimensions text,
    file_size integer,
    instructions text,
    is_active boolean DEFAULT true,
    download_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: affiliate_commissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_commissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    affiliate_id uuid NOT NULL,
    referral_id uuid NOT NULL,
    payout_id uuid,
    billing_period_start date NOT NULL,
    billing_period_end date NOT NULL,
    subscription_amount numeric(10,2) NOT NULL,
    commission_rate numeric(4,2) NOT NULL,
    commission_amount numeric(10,2) NOT NULL,
    status text DEFAULT 'pending'::text,
    cleared_at timestamp with time zone,
    stripe_invoice_id text,
    stripe_payment_intent_id text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: affiliate_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    affiliate_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    gross_amount numeric(10,2) NOT NULL,
    fees numeric(10,2) DEFAULT 0,
    net_amount numeric(10,2) NOT NULL,
    referral_count integer DEFAULT 0,
    referral_ids uuid[] DEFAULT '{}'::uuid[],
    status text DEFAULT 'pending'::text,
    payout_method text,
    payout_reference text,
    paid_at timestamp with time zone,
    failed_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: affiliate_referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_referrals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    affiliate_id uuid NOT NULL,
    referred_user_id uuid,
    referred_email text,
    referral_code text NOT NULL,
    landing_page text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    ip_address text,
    user_agent text,
    cookie_id text,
    cookie_created_at timestamp with time zone DEFAULT now(),
    cookie_expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval),
    status text DEFAULT 'clicked'::text,
    signed_up_at timestamp with time zone,
    subscribed_at timestamp with time zone,
    churned_at timestamp with time zone,
    subscription_id text,
    subscription_plan text,
    subscription_amount numeric(10,2),
    subscription_interval text,
    commission_rate numeric(4,2),
    commission_months_remaining integer,
    total_commission_paid numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: affiliates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    code text NOT NULL,
    commission_rate numeric(4,2) DEFAULT 0.50,
    commission_cap_months integer DEFAULT 12,
    status text DEFAULT 'pending'::text,
    tier text DEFAULT 'standard'::text,
    payout_method text,
    payout_details jsonb DEFAULT '{}'::jsonb,
    payout_minimum numeric(10,2) DEFAULT 50.00,
    company_name text,
    website text,
    social_profiles jsonb DEFAULT '{}'::jsonb,
    promotional_methods text[],
    total_referrals integer DEFAULT 0,
    active_referrals integer DEFAULT 0,
    total_earnings numeric(12,2) DEFAULT 0,
    pending_earnings numeric(12,2) DEFAULT 0,
    paid_earnings numeric(12,2) DEFAULT 0,
    approved_by uuid,
    approved_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: agent_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_runs (
    id text NOT NULL,
    workspace_id uuid NOT NULL,
    agent_name text NOT NULL,
    agent_version text,
    status text DEFAULT 'running'::text NOT NULL,
    input jsonb NOT NULL,
    output jsonb,
    steps jsonb DEFAULT '[]'::jsonb NOT NULL,
    total_tokens integer DEFAULT 0,
    total_cost_cents integer DEFAULT 0,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT agent_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text, 'waiting_approval'::text, 'cancelled'::text])))
);


--
-- Name: ai_traces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_traces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid,
    user_id uuid,
    operation_type text NOT NULL,
    model text NOT NULL,
    prompt_tokens integer,
    completion_tokens integer,
    total_tokens integer,
    latency_ms integer NOT NULL,
    success boolean DEFAULT true NOT NULL,
    error text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_traces_operation_type_check CHECK ((operation_type = ANY (ARRAY['generate'::text, 'stream'::text, 'embed'::text, 'tool_call'::text])))
);


--
-- Name: angles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.angles (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    campaign_id uuid,
    name text NOT NULL,
    description text,
    rank integer DEFAULT 0,
    trust_score integer DEFAULT 100,
    rationale text,
    payload jsonb,
    created_at timestamp with time zone DEFAULT now(),
    evidence_cited text[] DEFAULT '{}'::text[],
    actual_conversion_rate numeric(8,6),
    impressions integer DEFAULT 0,
    conversions integer DEFAULT 0,
    performance_validated boolean DEFAULT false,
    CONSTRAINT angles_trust_score_check CHECK (((trust_score >= 0) AND (trust_score <= 100)))
);


--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    key_hash text NOT NULL,
    key_prefix text NOT NULL,
    permissions jsonb DEFAULT '{"claims": false, "evidence": false, "validate": true}'::jsonb,
    rate_limit integer DEFAULT 100,
    last_used_at timestamp with time zone,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: TABLE api_keys; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.api_keys IS 'API keys for external access to ClaimsOS public API (/api/v1/validate)';


--
-- Name: api_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    api_key_id uuid,
    endpoint text NOT NULL,
    method text NOT NULL,
    claims_count integer DEFAULT 0,
    response_status integer,
    latency_ms integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE api_usage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.api_usage IS 'Usage tracking for API billing and analytics';


--
-- Name: approval_decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_decisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    instance_id uuid NOT NULL,
    stage_index integer NOT NULL,
    decision text NOT NULL,
    decision_by uuid,
    decision_notes text,
    requested_changes text,
    decided_at timestamp with time zone DEFAULT now()
);


--
-- Name: approval_instances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_instances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    template_id uuid,
    campaign_id uuid,
    content_type text,
    content_id uuid,
    content_snapshot jsonb,
    current_stage integer DEFAULT 0,
    stages_config jsonb NOT NULL,
    status text DEFAULT 'pending'::text,
    submitted_by uuid,
    submission_notes text,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: approval_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_requests (
    id text NOT NULL,
    workspace_id uuid NOT NULL,
    agent_run_id text,
    type text NOT NULL,
    risk_level text NOT NULL,
    title text NOT NULL,
    description text,
    context jsonb DEFAULT '{}'::jsonb NOT NULL,
    required_approvers text[] DEFAULT '{}'::text[] NOT NULL,
    min_approvals integer DEFAULT 1 NOT NULL,
    approvals jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    resolved_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT approval_requests_risk_level_check CHECK ((risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT approval_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'expired'::text, 'escalated'::text]))),
    CONSTRAINT approval_requests_type_check CHECK ((type = ANY (ARRAY['claim_review'::text, 'deployment'::text, 'high_value_action'::text, 'policy_override'::text, 'data_access'::text])))
);


--
-- Name: approval_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    stages jsonb DEFAULT '[]'::jsonb NOT NULL,
    conditions jsonb DEFAULT '{}'::jsonb,
    auto_escalation jsonb DEFAULT '{}'::jsonb,
    notifications jsonb DEFAULT '{}'::jsonb,
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approvals (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    claim_id uuid NOT NULL,
    reviewer_id uuid NOT NULL,
    decision text NOT NULL,
    comment text,
    policy_version integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT approvals_decision_check CHECK ((decision = ANY (ARRAY['approved'::text, 'rejected'::text, 'needs_changes'::text])))
);


--
-- Name: assembled_videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assembled_videos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    script_id uuid,
    voiceover_id uuid,
    template_id text,
    include_captions boolean DEFAULT true,
    video_url text,
    thumbnail_url text,
    format text NOT NULL,
    resolution text DEFAULT '1080p'::text,
    duration integer,
    file_size bigint,
    status text DEFAULT 'pending'::text,
    error_message text,
    render_progress integer DEFAULT 0,
    render_cost numeric(10,4),
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    CONSTRAINT assembled_videos_format_check CHECK ((format = ANY (ARRAY['16:9'::text, '9:16'::text, '1:1'::text]))),
    CONSTRAINT assembled_videos_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'rendering'::text, 'complete'::text, 'failed'::text])))
);


--
-- Name: TABLE assembled_videos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.assembled_videos IS 'Final rendered video files';


--
-- Name: asset_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    project_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    parent_id uuid,
    user_id uuid NOT NULL,
    content text NOT NULL,
    mentions uuid[] DEFAULT '{}'::uuid[],
    resolved boolean DEFAULT false,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    "position" jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: asset_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    brand_id uuid,
    campaign_id uuid,
    asset_type text NOT NULL,
    channel text,
    html text DEFAULT ''::text NOT NULL,
    blocks_json jsonb DEFAULT '[]'::jsonb,
    design_tokens jsonb DEFAULT '{}'::jsonb,
    claims_json jsonb DEFAULT '[]'::jsonb,
    evidence_json jsonb DEFAULT '[]'::jsonb,
    compliance_status text DEFAULT 'clean'::text,
    dimensions jsonb,
    rendered_image_url text,
    render_variants jsonb DEFAULT '[]'::jsonb,
    revision integer DEFAULT 1,
    parent_revision_id uuid,
    status text DEFAULT 'draft'::text,
    title text,
    description text,
    skeleton_id text,
    generation_key text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    brain_snapshot_id uuid,
    provenance_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT asset_documents_asset_type_check CHECK ((asset_type = ANY (ARRAY['landing'::text, 'social'::text, 'email'::text, 'deck'::text, 'ad'::text]))),
    CONSTRAINT asset_documents_channel_check CHECK ((channel = ANY (ARRAY['linkedin'::text, 'instagram'::text, 'twitter'::text, 'facebook'::text, 'meta'::text, 'google'::text]))),
    CONSTRAINT asset_documents_compliance_status_check CHECK ((compliance_status = ANY (ARRAY['clean'::text, 'warning'::text, 'blocked'::text]))),
    CONSTRAINT asset_documents_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'review'::text, 'approved'::text, 'published'::text])))
);


--
-- Name: asset_renders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_renders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_document_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    format text NOT NULL,
    width integer,
    height integer,
    storage_url text NOT NULL,
    storage_provider text DEFAULT 'supabase'::text,
    file_size integer,
    status text DEFAULT 'completed'::text,
    provider_artifact_json jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT asset_renders_format_check CHECK ((format = ANY (ARRAY['png'::text, 'jpg'::text, 'pdf'::text, 'html'::text, 'pptx'::text]))),
    CONSTRAINT asset_renders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text]))),
    CONSTRAINT asset_renders_storage_provider_check CHECK ((storage_provider = ANY (ARRAY['supabase'::text, 'r2'::text])))
);


--
-- Name: audiences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audiences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    title text,
    description text,
    seniority text,
    department text,
    company_size text,
    industry text,
    pain_points text[] DEFAULT '{}'::text[],
    goals text[] DEFAULT '{}'::text[],
    buying_triggers text[] DEFAULT '{}'::text[],
    objections text[] DEFAULT '{}'::text[],
    decision_criteria text[] DEFAULT '{}'::text[],
    language_style text DEFAULT 'professional'::text,
    jargon_level text DEFAULT 'moderate'::text,
    formality_level text DEFAULT 'professional'::text,
    tone_adjustments jsonb DEFAULT '{}'::jsonb,
    preferred_content_types text[] DEFAULT '{}'::text[],
    preferred_channels text[] DEFAULT '{}'::text[],
    demographic_notes text,
    competitive_context text,
    success_metrics text,
    is_primary boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    workspace_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    action text NOT NULL,
    before_state jsonb,
    after_state jsonb,
    actor_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['create'::text, 'update'::text, 'delete'::text, 'approve'::text, 'reject'::text, 'link'::text, 'unlink'::text, 'export'::text]))),
    CONSTRAINT audit_log_entity_type_check CHECK ((entity_type = ANY (ARRAY['claim'::text, 'evidence'::text, 'policy'::text, 'approval'::text, 'claim_pack'::text])))
)
WITH (autovacuum_enabled='true');


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id text NOT NULL,
    user_email text,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    resource_name text,
    old_values jsonb,
    new_values jsonb,
    ip_address inet,
    user_agent text,
    request_id text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: automation_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    brand_id uuid NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    schedule text NOT NULL,
    timezone text DEFAULT 'UTC'::text,
    config jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'draft'::text,
    last_run_at timestamp with time zone,
    next_run_at timestamp with time zone,
    run_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT automation_rules_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'archived'::text]))),
    CONSTRAINT automation_rules_type_check CHECK ((type = ANY (ARRAY['daily_linkedin'::text, 'weekly_social'::text, 'campaign_drip'::text, 'custom'::text])))
);


--
-- Name: automation_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    automation_rule_id uuid NOT NULL,
    run_key text NOT NULL,
    triggered_by uuid,
    trigger_type text DEFAULT 'manual'::text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    error text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT automation_runs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'succeeded'::text, 'failed'::text]))),
    CONSTRAINT automation_runs_trigger_type_check CHECK ((trigger_type = ANY (ARRAY['manual'::text, 'scheduled'::text])))
);


--
-- Name: battle_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.battle_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    competitor_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    strengths text[] DEFAULT '{}'::text[],
    weaknesses text[] DEFAULT '{}'::text[],
    counter_messages jsonb DEFAULT '[]'::jsonb,
    winning_angles text[] DEFAULT '{}'::text[],
    lose_tos text[] DEFAULT '{}'::text[],
    key_differentiators text[] DEFAULT '{}'::text[],
    model_used text,
    prompt_used text,
    version integer DEFAULT 1,
    generated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE battle_cards; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.battle_cards IS 'AI-generated competitive battle cards';


--
-- Name: bigquery_sync_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bigquery_sync_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    project_id text NOT NULL,
    dataset_id text NOT NULL,
    table_id text,
    service_account_json jsonb,
    sync_type text DEFAULT 'export'::text NOT NULL,
    sync_schedule text,
    query text,
    field_mappings jsonb DEFAULT '{}'::jsonb,
    last_synced_at timestamp with time zone,
    last_sync_status text,
    last_sync_error text,
    rows_synced integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: bigquery_sync_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bigquery_sync_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sync_config_id uuid NOT NULL,
    status text NOT NULL,
    rows_processed integer DEFAULT 0,
    bytes_processed bigint DEFAULT 0,
    duration_ms integer,
    error_message text,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);


--
-- Name: brain_learning_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brain_learning_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    status text DEFAULT 'completed'::text NOT NULL,
    summary_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT brain_learning_runs_status_check CHECK ((status = ANY (ARRAY['completed'::text, 'failed'::text])))
);


--
-- Name: brain_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brain_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    brand_id uuid,
    status text DEFAULT 'draft'::text NOT NULL,
    source_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    summary_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    priority_rules_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT brain_snapshots_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'superseded'::text, 'archived'::text])))
);


--
-- Name: brain_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brain_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    brand_id uuid,
    source_type text NOT NULL,
    connection_ref text,
    external_id text,
    display_name text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    last_synced_at timestamp with time zone,
    last_snapshot_id uuid,
    config_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT brain_sources_source_type_check CHECK ((source_type = ANY (ARRAY['url'::text, 'webflow'::text, 'framer'::text, 'notion'::text, 'github'::text, 'file_upload'::text, 'manual'::text]))),
    CONSTRAINT brain_sources_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'connected'::text, 'syncing'::text, 'ready'::text, 'review_required'::text, 'error'::text, 'disabled'::text])))
);


--
-- Name: brain_sync_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brain_sync_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brain_source_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    changes_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    error_text text,
    metrics_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT brain_sync_runs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'completed'::text, 'review_required'::text, 'failed'::text])))
);


--
-- Name: brand_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_id uuid NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    format text,
    url text NOT NULL,
    width integer,
    height integer,
    file_size integer,
    usage text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: brand_memory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_memory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    colors jsonb DEFAULT '[]'::jsonb NOT NULL,
    fonts jsonb DEFAULT '[]'::jsonb NOT NULL,
    spacing jsonb DEFAULT '{}'::jsonb,
    components jsonb DEFAULT '[]'::jsonb,
    tone jsonb DEFAULT '{}'::jsonb,
    banned_terms text[] DEFAULT '{}'::text[],
    preferred_terms text[] DEFAULT '{}'::text[],
    key_messages text[] DEFAULT '{}'::text[],
    logo_urls text[] DEFAULT '{}'::text[],
    icon_urls text[] DEFAULT '{}'::text[],
    sources jsonb DEFAULT '[]'::jsonb,
    version integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: budget_alert_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budget_alert_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alert_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    threshold_value numeric(10,2),
    current_value numeric(10,2),
    percentage_used numeric(5,2),
    period_start timestamp with time zone,
    period_end timestamp with time zone,
    notification_sent boolean DEFAULT false,
    notification_channels text[] DEFAULT '{}'::text[],
    notification_error text,
    triggered_at timestamp with time zone DEFAULT now()
);


--
-- Name: budget_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budget_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    threshold_type text NOT NULL,
    threshold_value numeric(10,2) NOT NULL,
    period text DEFAULT 'monthly'::text,
    notification_channels text[] DEFAULT ARRAY['email'::text],
    notification_emails text[] DEFAULT '{}'::text[],
    slack_webhook_url text,
    custom_webhook_url text,
    is_active boolean DEFAULT true,
    is_triggered boolean DEFAULT false,
    triggered_at timestamp with time zone,
    cooldown_hours integer DEFAULT 24,
    last_notification_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: campaign_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    asset_type text NOT NULL,
    content jsonb NOT NULL,
    version integer DEFAULT 1,
    status text DEFAULT 'draft'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT campaign_assets_asset_type_check CHECK ((asset_type = ANY (ARRAY['email_sequence'::text, 'ad_variants'::text, 'sales_one_pager'::text, 'talk_track'::text, 'custom'::text]))),
    CONSTRAINT campaign_assets_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'deployed'::text])))
);


--
-- Name: TABLE campaign_assets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.campaign_assets IS 'Multi-asset campaign content: landing pages, social posts, decks, videos, etc.';


--
-- Name: campaign_claim_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_claim_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    campaign_id uuid NOT NULL,
    claim_id uuid NOT NULL,
    asset_document_id uuid,
    message_id uuid,
    source text DEFAULT 'asset_document'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT campaign_claim_links_source_check CHECK ((source = ANY (ARRAY['asset_document'::text, 'message'::text, 'import'::text, 'manual'::text])))
);


--
-- Name: campaign_fact_citations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_fact_citations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    campaign_id uuid NOT NULL,
    fact_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: campaign_targeting_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_targeting_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    rule_type text NOT NULL,
    config jsonb NOT NULL,
    operator text DEFAULT 'AND'::text,
    rule_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: campaign_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_versions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    campaign_id uuid,
    version integer NOT NULL,
    parent_version_id uuid,
    diff jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaigns (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    workspace_id uuid,
    name text NOT NULL,
    status text DEFAULT 'draft'::text,
    audience text,
    goal text,
    offer text,
    cta text,
    constraints jsonb,
    selected_angle_id uuid,
    version integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tracking_id text,
    audience_id uuid,
    target_language text DEFAULT 'en'::text,
    target_languages text[] DEFAULT ARRAY['en'::text],
    approval_template_id uuid,
    approval_status text DEFAULT 'not_required'::text,
    current_version integer DEFAULT 1,
    version_count integer DEFAULT 1,
    brain_snapshot_id uuid,
    brand_id uuid,
    landing_design_id uuid,
    CONSTRAINT campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'generating'::text, 'ready'::text, 'published'::text, 'running'::text, 'archived'::text, 'failed'::text])))
);


--
-- Name: COLUMN campaigns.landing_design_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.landing_design_id IS 'Canonical link to the website_designs record that represents this campaign''s landing page. Legacy page_blocks remain read-only compatibility data.';


--
-- Name: cancellation_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cancellation_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    reason text NOT NULL,
    feedback text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT valid_reason CHECK ((reason = ANY (ARRAY['too_expensive'::text, 'missing_features'::text, 'switched_competitor'::text, 'not_using'::text, 'temporary_pause'::text, 'other'::text])))
);


--
-- Name: canvas_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.canvas_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    canvas_id uuid NOT NULL,
    x double precision NOT NULL,
    y double precision NOT NULL,
    element_id text,
    content text NOT NULL,
    parent_comment_id uuid,
    thread_id uuid,
    author_id uuid,
    author_name text,
    is_resolved boolean DEFAULT false,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: canvas_elements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.canvas_elements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    canvas_id uuid NOT NULL,
    element_id text NOT NULL,
    type text NOT NULL,
    x double precision DEFAULT 0 NOT NULL,
    y double precision DEFAULT 0 NOT NULL,
    width double precision,
    height double precision,
    rotation double precision DEFAULT 0,
    z_index integer DEFAULT 0,
    content jsonb DEFAULT '{}'::jsonb,
    style jsonb DEFAULT '{}'::jsonb,
    group_id text,
    parent_id text,
    is_locked boolean DEFAULT false,
    locked_by uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: canvas_presence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.canvas_presence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    canvas_id uuid NOT NULL,
    user_id uuid NOT NULL,
    cursor_x double precision,
    cursor_y double precision,
    selected_elements text[] DEFAULT '{}'::text[],
    user_name text,
    user_color text,
    is_active boolean DEFAULT true,
    last_active_at timestamp with time zone DEFAULT now(),
    session_id text
);


--
-- Name: canvas_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.canvas_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    canvas_id uuid NOT NULL,
    version_number integer NOT NULL,
    elements_snapshot jsonb NOT NULL,
    description text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: canvases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.canvases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    campaign_id uuid,
    elements jsonb DEFAULT '[]'::jsonb NOT NULL,
    viewport jsonb DEFAULT '{"x": 0, "y": 0, "zoom": 1}'::jsonb,
    background_color text DEFAULT '#0f0f0f'::text,
    grid_enabled boolean DEFAULT true,
    snap_to_grid boolean DEFAULT true,
    grid_size integer DEFAULT 20,
    width integer DEFAULT 1920,
    height integer DEFAULT 1080,
    is_public boolean DEFAULT false,
    allow_comments boolean DEFAULT true,
    allow_editing boolean DEFAULT true,
    version integer DEFAULT 1,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    last_edited_by uuid,
    last_edited_at timestamp with time zone
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    tool_calls jsonb DEFAULT '[]'::jsonb,
    tool_results jsonb DEFAULT '[]'::jsonb,
    model text,
    tokens_used integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chat_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text, 'tool'::text])))
);


--
-- Name: chat_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    title text DEFAULT 'New Chat'::text NOT NULL,
    model text DEFAULT 'openai/gpt-5.2-chat'::text NOT NULL,
    campaign_id uuid,
    is_archived boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: claim_evidence_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.claim_evidence_links (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    claim_id uuid NOT NULL,
    evidence_id uuid NOT NULL,
    relevance_note text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: claim_packs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.claim_packs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    claim_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    export_format text DEFAULT 'json'::text,
    share_token text,
    expires_at timestamp with time zone,
    file_path text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT claim_packs_export_format_check CHECK ((export_format = ANY (ARRAY['json'::text, 'markdown'::text, 'pdf'::text])))
);


--
-- Name: claim_performance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.claim_performance (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    workspace_id uuid NOT NULL,
    claim_hash text NOT NULL,
    claim_text text NOT NULL,
    campaign_id uuid,
    claim_id uuid,
    impressions integer DEFAULT 0,
    conversions integer DEFAULT 0,
    conversion_rate numeric(8,6) GENERATED ALWAYS AS (
CASE
    WHEN (impressions > 0) THEN ((conversions)::numeric / (impressions)::numeric)
    ELSE (0)::numeric
END) STORED,
    performance_score integer DEFAULT 50,
    confidence_level text DEFAULT 'low'::text,
    category text DEFAULT 'generic'::text,
    claim_type text DEFAULT 'soft'::text,
    first_seen_at timestamp with time zone DEFAULT now(),
    last_impression_at timestamp with time zone,
    last_conversion_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT claim_performance_confidence_level_check CHECK ((confidence_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT claim_performance_performance_score_check CHECK (((performance_score >= 0) AND (performance_score <= 100)))
);


--
-- Name: TABLE claim_performance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.claim_performance IS 'Performance tracking for marketing claims';


--
-- Name: claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.claims (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    workspace_id uuid NOT NULL,
    text text NOT NULL,
    original_text text,
    claim_type text DEFAULT 'soft'::text NOT NULL,
    category text DEFAULT 'generic'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    risk_score integer DEFAULT 0,
    reason_codes jsonb DEFAULT '[]'::jsonb,
    required_evidence_tier text,
    suggested_rewrites jsonb DEFAULT '[]'::jsonb,
    policy_version integer,
    created_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT claims_category_check CHECK ((category = ANY (ARRAY['performance'::text, 'security'::text, 'pricing'::text, 'compliance'::text, 'generic'::text]))),
    CONSTRAINT claims_claim_type_check CHECK ((claim_type = ANY (ARRAY['hard'::text, 'soft'::text, 'unverified'::text]))),
    CONSTRAINT claims_required_evidence_tier_check CHECK ((required_evidence_tier = ANY (ARRAY['A'::text, 'B'::text, 'C'::text]))),
    CONSTRAINT claims_risk_score_check CHECK (((risk_score >= 0) AND (risk_score <= 100))),
    CONSTRAINT claims_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'needs_proof'::text, 'blocked'::text, 'ready_review'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: comment_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comment_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: comment_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comment_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    reaction text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: competitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competitors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    domain text NOT NULL,
    name text NOT NULL,
    logo_url text,
    description text,
    metrics jsonb DEFAULT '{}'::jsonb,
    metrics_history jsonb DEFAULT '[]'::jsonb,
    status text DEFAULT 'active'::text,
    last_updated timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT competitors_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text])))
);


--
-- Name: TABLE competitors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.competitors IS 'Tracked competitors with public metrics';


--
-- Name: compliance_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text DEFAULT encode(extensions.gen_random_bytes(16), 'hex'::text) NOT NULL,
    original_text text NOT NULL,
    industry text DEFAULT 'generic'::text NOT NULL,
    results jsonb DEFAULT '[]'::jsonb NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    compliance_score integer DEFAULT 0 NOT NULL,
    average_risk_score integer DEFAULT 0 NOT NULL,
    ip_hash text,
    user_agent text,
    is_public boolean DEFAULT true,
    view_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval)
);


--
-- Name: TABLE compliance_reports; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.compliance_reports IS 'Stores shareable validation reports from /gate';


--
-- Name: component_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.component_categories (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    icon text,
    sort_order integer DEFAULT 0
);


--
-- Name: composer_document_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.composer_document_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    document_id uuid NOT NULL,
    version_number integer NOT NULL,
    version_label text,
    source_campaign_version_id uuid,
    snapshot_html text,
    snapshot_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: composer_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.composer_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    campaign_id uuid,
    title text NOT NULL,
    asset_type text NOT NULL,
    quality_score numeric(5,2) DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT composer_documents_asset_type_check CHECK ((asset_type = ANY (ARRAY['landing'::text, 'deck'::text, 'social'::text, 'email'::text, 'other'::text])))
);


--
-- Name: composer_feedback_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.composer_feedback_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    campaign_id uuid NOT NULL,
    sako_task_id uuid,
    escalation_id uuid,
    snapshot_id uuid,
    event_type text NOT NULL,
    outcome text,
    quality_score integer,
    revision_count integer DEFAULT 0,
    cycle_time_seconds integer,
    time_to_first_delivery integer,
    time_to_acceptance integer,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT composer_feedback_events_event_type_check CHECK ((event_type = ANY (ARRAY['task_created'::text, 'task_assigned'::text, 'task_in_progress'::text, 'task_in_review'::text, 'task_revision_requested'::text, 'task_completed'::text, 'task_cancelled'::text, 'task_accepted'::text, 'task_rejected'::text, 'deliverable_uploaded'::text, 'feedback_submitted'::text]))),
    CONSTRAINT composer_feedback_events_outcome_check CHECK ((outcome = ANY (ARRAY['accepted'::text, 'rejected'::text, 'revised'::text, 'cancelled'::text]))),
    CONSTRAINT composer_feedback_events_quality_score_check CHECK (((quality_score >= 1) AND (quality_score <= 5)))
);


--
-- Name: composer_feedback_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.composer_feedback_summary AS
 SELECT workspace_id,
    campaign_id,
    sako_task_id,
    count(*) AS total_events,
    count(*) FILTER (WHERE (event_type = 'task_completed'::text)) AS completions,
    count(*) FILTER (WHERE (event_type = 'task_accepted'::text)) AS acceptances,
    count(*) FILTER (WHERE (event_type = 'task_rejected'::text)) AS rejections,
    avg(quality_score) FILTER (WHERE (quality_score IS NOT NULL)) AS avg_quality_score,
    avg(cycle_time_seconds) FILTER (WHERE (cycle_time_seconds IS NOT NULL)) AS avg_cycle_time,
    sum(revision_count) AS total_revisions
   FROM public.composer_feedback_events
  GROUP BY workspace_id, campaign_id, sako_task_id;


--
-- Name: composer_sends; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.composer_sends (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    document_id uuid NOT NULL,
    version_id uuid NOT NULL,
    task_id uuid,
    idempotency_key text NOT NULL,
    status text DEFAULT 'processing'::text NOT NULL,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT composer_sends_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: composer_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.composer_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    campaign_id uuid NOT NULL,
    version_number integer DEFAULT 1 NOT NULL,
    version_label text,
    html_content text,
    json_content jsonb,
    preview_url text,
    asset_type text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    storage_provider text DEFAULT 'database'::text,
    storage_key text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    CONSTRAINT composer_snapshots_asset_type_check CHECK ((asset_type = ANY (ARRAY['landing'::text, 'deck'::text, 'social'::text, 'email'::text, 'other'::text]))),
    CONSTRAINT composer_snapshots_storage_provider_check CHECK ((storage_provider = ANY (ARRAY['database'::text, 's3'::text, 'r2'::text])))
);


--
-- Name: content_ideas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_ideas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    brand_id uuid,
    title text NOT NULL,
    description text,
    content_type text DEFAULT 'ad'::text NOT NULL,
    framework text,
    angle_data jsonb DEFAULT '{}'::jsonb,
    hook text,
    target_pain_point text,
    emotional_trigger text,
    suggested_cta text,
    preview_html text,
    preview_image_url text,
    status text DEFAULT 'pending'::text,
    source text DEFAULT 'manual'::text,
    generated_at timestamp with time zone DEFAULT now(),
    reviewed_at timestamp with time zone,
    used_at timestamp with time zone,
    used_in_campaign_id uuid,
    generation_model text,
    generation_prompt text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    archetype_id text,
    CONSTRAINT content_ideas_source_check CHECK ((source = ANY (ARRAY['background'::text, 'manual'::text, 'competitor'::text, 'trend'::text, 'archetype'::text])))
);


--
-- Name: cost_forecasts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_forecasts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    forecast_date date NOT NULL,
    period_type text NOT NULL,
    actual_cost numeric(10,2),
    actual_tokens integer,
    actual_calls integer,
    forecasted_cost numeric(10,2),
    forecasted_tokens integer,
    forecasted_calls integer,
    confidence_level numeric(3,2),
    forecast_model text,
    cost_breakdown jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: creator_earnings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creator_earnings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    creator_id uuid NOT NULL,
    template_id uuid NOT NULL,
    purchase_id uuid NOT NULL,
    amount_cents integer NOT NULL,
    status text DEFAULT 'pending'::text,
    payout_id text,
    created_at timestamp with time zone DEFAULT now(),
    paid_at timestamp with time zone
);


--
-- Name: custom_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    permission_ids text[] DEFAULT '{}'::text[] NOT NULL,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: deck_slides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deck_slides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid,
    slide_order integer NOT NULL,
    slide_type text NOT NULL,
    headline text,
    subheadline text,
    bullets text[] DEFAULT '{}'::text[],
    speaker_notes text,
    layout text DEFAULT 'default'::text,
    visual_suggestion text,
    image_url text,
    claim_ids uuid[] DEFAULT '{}'::uuid[],
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT deck_slides_slide_type_check CHECK ((slide_type = ANY (ARRAY['title'::text, 'problem'::text, 'solution'::text, 'features'::text, 'proof'::text, 'comparison'::text, 'pricing'::text, 'cta'::text, 'quote'::text, 'stats'::text, 'blank'::text])))
);


--
-- Name: TABLE deck_slides; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.deck_slides IS 'Individual slides for sales deck assets';


--
-- Name: deployments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deployments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    campaign_id uuid,
    angle_id uuid,
    idempotency_key text NOT NULL,
    status text DEFAULT 'pending'::text,
    hubspot_payload jsonb,
    hubspot_result jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT deployments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'partial'::text, 'success'::text, 'failed'::text])))
);


--
-- Name: design_quality_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_quality_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    asset_document_id uuid,
    event_type text NOT NULL,
    original_html text,
    edited_html text,
    edit_diff jsonb,
    quality_score numeric(3,2),
    skeleton_id text,
    template_ids text[],
    issues_json jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT design_quality_events_event_type_check CHECK ((event_type = ANY (ARRAY['generated'::text, 'accepted'::text, 'edited'::text, 'rejected'::text, 'exported'::text])))
);


--
-- Name: design_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section_id text NOT NULL,
    template_name text NOT NULL,
    category text NOT NULL,
    industry text[] DEFAULT '{}'::text[],
    visual_style jsonb DEFAULT '{}'::jsonb,
    design_tokens jsonb DEFAULT '{}'::jsonb,
    html text NOT NULL,
    description text NOT NULL,
    embedding public.vector(1536),
    source_file text,
    source_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    quality_score double precision DEFAULT 0.5,
    times_used integer DEFAULT 0,
    times_accepted integer DEFAULT 0,
    times_edited integer DEFAULT 0,
    times_rejected integer DEFAULT 0,
    avg_edit_distance double precision DEFAULT 0,
    source text DEFAULT 'seed'::text,
    parent_generation_id uuid,
    components text[] DEFAULT '{}'::text[],
    suitable_for text[] DEFAULT '{}'::text[],
    aesthetic_tags text[] DEFAULT '{}'::text[],
    section_order integer DEFAULT 0,
    original_template_id uuid,
    remix_count integer DEFAULT 0,
    price_cents integer,
    creator_payout_percent integer DEFAULT 70,
    design_skeleton jsonb,
    skeleton_css text,
    skeleton_html text,
    complexity_score integer,
    aesthetic_signature public.vector(384),
    CONSTRAINT design_templates_category_check CHECK ((category = ANY (ARRAY['hero'::text, 'features'::text, 'pricing'::text, 'testimonials'::text, 'faq'::text, 'cta'::text, 'footer'::text, 'logos'::text, 'stats'::text, 'team'::text, 'gallery'::text, 'contact'::text, 'about'::text, 'process'::text, 'comparison'::text]))),
    CONSTRAINT design_templates_complexity_score_check CHECK (((complexity_score >= 1) AND (complexity_score <= 10)))
);


--
-- Name: escalations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.escalations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    campaign_id uuid NOT NULL,
    sako_task_id uuid,
    idempotency_key text NOT NULL,
    reason text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    retry_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    CONSTRAINT escalations_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT escalations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: sako_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sako_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    brand_id uuid,
    sako_v1_id text,
    type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    brief text NOT NULL,
    reason text,
    current_html text,
    feedback text,
    assigned_to text,
    estimated_delivery timestamp with time zone,
    deliverables jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    title text,
    idempotency_key text,
    metadata jsonb DEFAULT '{}'::jsonb,
    comments jsonb DEFAULT '[]'::jsonb,
    assigned_to_name text,
    source text DEFAULT 'composer'::text,
    asset_type text,
    snapshot_id uuid,
    CONSTRAINT sako_tasks_asset_type_check CHECK ((asset_type = ANY (ARRAY['landing'::text, 'deck'::text, 'social'::text, 'email'::text, 'other'::text]))),
    CONSTRAINT sako_tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT sako_tasks_source_check CHECK ((source = ANY (ARRAY['composer'::text, 'manual'::text, 'api'::text]))),
    CONSTRAINT sako_tasks_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'assigned'::text, 'in_progress'::text, 'review'::text, 'completed'::text, 'cancelled'::text]))),
    CONSTRAINT sako_tasks_type_check CHECK ((type = ANY (ARRAY['design_refinement'::text, 'full_redesign'::text, 'copywriting'::text, 'brand_refresh'::text])))
);


--
-- Name: escalations_with_campaign; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.escalations_with_campaign AS
 SELECT e.id,
    e.workspace_id,
    e.campaign_id,
    e.sako_task_id,
    e.idempotency_key,
    e.reason,
    e.priority,
    e.status,
    e.error_message,
    e.retry_count,
    e.created_at,
    e.updated_at,
    e.completed_at,
    c.name AS campaign_name,
    c.status AS campaign_status,
    st.status AS sako_task_status,
    st.deliverables AS sako_task_deliverables
   FROM ((public.escalations e
     LEFT JOIN public.campaigns c ON ((c.id = e.campaign_id)))
     LEFT JOIN public.sako_tasks st ON ((st.id = e.sako_task_id)));


--
-- Name: evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evidence (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    workspace_id uuid,
    type text NOT NULL,
    title text NOT NULL,
    content text,
    url text,
    file_path text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    tier text DEFAULT 'C'::text,
    source_type text,
    CONSTRAINT evidence_source_type_check CHECK ((source_type = ANY (ARRAY['third_party_report'::text, 'customer_contract'::text, 'audited_metric'::text, 'case_study'::text, 'testimonial'::text, 'internal_doc'::text, 'screenshot'::text, 'anecdote'::text, 'other'::text]))),
    CONSTRAINT evidence_tier_check CHECK ((tier = ANY (ARRAY['A'::text, 'B'::text, 'C'::text]))),
    CONSTRAINT evidence_type_check CHECK ((type = ANY (ARRAY['url'::text, 'text'::text, 'file'::text, 'metric'::text])))
);


--
-- Name: experiment_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.experiment_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    experiment_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    visitor_id text NOT NULL,
    user_id text,
    session_id text,
    assigned_at timestamp with time zone DEFAULT now(),
    ip_hash text,
    user_agent text
);


--
-- Name: experiment_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.experiment_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    experiment_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    assignment_id uuid,
    event_type text NOT NULL,
    event_name text,
    is_conversion boolean DEFAULT false,
    conversion_value double precision,
    time_on_page_ms integer,
    scroll_depth_percent integer,
    element_id text,
    element_type text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: experiment_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.experiment_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    experiment_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    date date NOT NULL,
    visitors integer DEFAULT 0,
    sessions integer DEFAULT 0,
    page_views integer DEFAULT 0,
    total_time_on_page_ms bigint DEFAULT 0,
    avg_time_on_page_ms integer DEFAULT 0,
    avg_scroll_depth integer DEFAULT 0,
    bounces integer DEFAULT 0,
    conversions integer DEFAULT 0,
    conversion_value double precision DEFAULT 0,
    conversion_rate double precision,
    bounce_rate double precision,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: experiment_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.experiment_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    experiment_id uuid NOT NULL,
    control_variant_id uuid NOT NULL,
    test_variant_id uuid NOT NULL,
    metric_name text NOT NULL,
    control_value double precision NOT NULL,
    test_value double precision NOT NULL,
    relative_uplift double precision,
    absolute_difference double precision,
    p_value double precision,
    confidence_level double precision,
    is_significant boolean,
    control_sample_size integer,
    test_sample_size integer,
    calculated_at timestamp with time zone DEFAULT now()
);


--
-- Name: experiment_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.experiment_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    experiment_id uuid NOT NULL,
    name text NOT NULL,
    is_control boolean DEFAULT false,
    traffic_weight integer DEFAULT 50,
    content_type text NOT NULL,
    content_changes jsonb DEFAULT '{}'::jsonb NOT NULL,
    html text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT experiment_variants_traffic_weight_check CHECK (((traffic_weight >= 0) AND (traffic_weight <= 100)))
);


--
-- Name: experiments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.experiments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    campaign_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    hypothesis text,
    status text DEFAULT 'draft'::text,
    traffic_percentage integer DEFAULT 100,
    primary_metric text NOT NULL,
    secondary_metrics text[] DEFAULT '{}'::text[],
    confidence_level double precision DEFAULT 0.95,
    minimum_sample_size integer DEFAULT 100,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    winner_variant_id uuid,
    final_confidence double precision,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by text NOT NULL,
    CONSTRAINT experiments_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'running'::text, 'paused'::text, 'completed'::text, 'archived'::text]))),
    CONSTRAINT experiments_traffic_percentage_check CHECK (((traffic_percentage >= 1) AND (traffic_percentage <= 100)))
);


--
-- Name: followup_flows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.followup_flows (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    campaign_id uuid,
    angle_id uuid,
    graph_json jsonb DEFAULT '{"edges": [], "nodes": []}'::jsonb,
    compiled_json jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: gallery_collection_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gallery_collection_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_id uuid NOT NULL,
    public_campaign_id uuid NOT NULL,
    display_order integer DEFAULT 0,
    curator_note text,
    added_at timestamp with time zone DEFAULT now()
);


--
-- Name: gallery_collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gallery_collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    cover_image_url text,
    curated_by uuid,
    is_official boolean DEFAULT false,
    is_published boolean DEFAULT false,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: gallery_interactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gallery_interactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    public_campaign_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid,
    interaction_type text NOT NULL,
    source text,
    session_id text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: generated_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.generated_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    campaign_id uuid,
    brand_id uuid,
    prompt text NOT NULL,
    enhanced_prompt text,
    negative_prompt text,
    style text,
    dimensions text,
    aspect_ratio text,
    model text DEFAULT 'google/gemini-3-pro-image'::text,
    model_version text,
    storage_path text NOT NULL,
    public_url text,
    thumbnail_url text,
    file_size_bytes integer,
    mime_type text DEFAULT 'image/png'::text,
    generation_params jsonb DEFAULT '{}'::jsonb,
    brand_colors_used text[],
    tags text[] DEFAULT '{}'::text[],
    used_in_campaigns uuid[] DEFAULT '{}'::uuid[],
    download_count integer DEFAULT 0,
    status text DEFAULT 'completed'::text,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: generations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.generations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    campaign_id uuid,
    brand_id uuid,
    user_id text NOT NULL,
    request_type text NOT NULL,
    request_prompt text NOT NULL,
    section_type text,
    retrieved_template_ids uuid[] DEFAULT '{}'::uuid[],
    retrieval_scores double precision[] DEFAULT '{}'::double precision[],
    generated_html text,
    final_html text,
    status text DEFAULT 'pending'::text,
    edit_distance integer,
    acceptance_score double precision,
    generation_time_ms integer,
    model_used text,
    tokens_used integer,
    cost_usd double precision,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT generations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'edited'::text, 'rejected'::text, 'deployed'::text])))
);


--
-- Name: hubspot_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hubspot_connections (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    workspace_id uuid,
    portal_id text NOT NULL,
    access_token_encrypted text NOT NULL,
    refresh_token_encrypted text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    scopes text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: hubspot_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hubspot_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    hubspot_id text NOT NULL,
    hubspot_portal_id text,
    email text,
    first_name text,
    last_name text,
    full_name text GENERATED ALWAYS AS (((COALESCE(first_name, ''::text) || ' '::text) || COALESCE(last_name, ''::text))) STORED,
    company_name text,
    company_id text,
    phone text,
    job_title text,
    lifecycle_stage text,
    lead_status text,
    list_ids text[] DEFAULT '{}'::text[],
    properties jsonb DEFAULT '{}'::jsonb,
    synced_at timestamp with time zone DEFAULT now(),
    hubspot_updated_at timestamp with time zone,
    engagement_score integer,
    last_email_open_date timestamp with time zone,
    last_email_click_date timestamp with time zone
);


--
-- Name: hubspot_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hubspot_lists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    hubspot_list_id text NOT NULL,
    name text NOT NULL,
    list_type text,
    contact_count integer DEFAULT 0,
    synced_at timestamp with time zone DEFAULT now(),
    is_available_for_targeting boolean DEFAULT true
);


--
-- Name: hubspot_sync_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hubspot_sync_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    job_type text NOT NULL,
    status text DEFAULT 'pending'::text,
    total_contacts integer,
    synced_contacts integer DEFAULT 0,
    total_lists integer,
    synced_lists integer DEFAULT 0,
    error_message text,
    errors_count integer DEFAULT 0,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: kit_deployments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kit_deployments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kit_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    provider text NOT NULL,
    url text NOT NULL,
    deployment_id text,
    status text DEFAULT 'success'::text,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT valid_provider CHECK ((provider = ANY (ARRAY['webflow'::text, 'hubspot'::text, 'framer'::text, 'subdomain'::text, 'figma'::text])))
);


--
-- Name: TABLE kit_deployments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.kit_deployments IS 'History of kit deployments to various providers';


--
-- Name: knowledge_collection_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_collection_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_id uuid NOT NULL,
    item_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: knowledge_collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    icon text DEFAULT '📁'::text,
    color text DEFAULT '#6366f1'::text,
    parent_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: knowledge_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    content text NOT NULL,
    content_type text NOT NULL,
    source_url text,
    file_path text,
    file_name text,
    file_size integer,
    mime_type text,
    metadata jsonb DEFAULT '{}'::jsonb,
    tags text[] DEFAULT '{}'::text[],
    embedding public.vector(1536),
    chunk_index integer DEFAULT 0,
    parent_id uuid,
    status text DEFAULT 'active'::text,
    error_message text,
    reference_count integer DEFAULT 0,
    last_referenced_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT knowledge_items_content_type_check CHECK ((content_type = ANY (ARRAY['document'::text, 'url'::text, 'manual'::text, 'data'::text]))),
    CONSTRAINT knowledge_items_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'active'::text, 'error'::text, 'archived'::text])))
);


--
-- Name: language_usage_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.language_usage_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    language_code text NOT NULL,
    content_type text,
    generation_count integer DEFAULT 0,
    last_used_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: launch_kits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.launch_kits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    brand_id uuid,
    brief jsonb NOT NULL,
    status text DEFAULT 'generating'::text,
    assets jsonb DEFAULT '{"ads": [], "deck": null, "emails": null, "landingPage": null, "socialPosts": []}'::jsonb,
    compliance jsonb DEFAULT '{"blocked": 0, "approved": 0, "needsReview": 0, "totalClaims": 0, "averageRiskScore": 0}'::jsonb,
    angles jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    exported_at timestamp with time zone,
    campaign_id uuid,
    CONSTRAINT valid_status CHECK ((status = ANY (ARRAY['generating'::text, 'review'::text, 'approved'::text, 'exported'::text])))
);


--
-- Name: TABLE launch_kits; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.launch_kits IS 'Complete marketing asset bundles generated from a brief';


--
-- Name: COLUMN launch_kits.brief; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.launch_kits.brief IS 'The LaunchKitBrief that defined what to generate';


--
-- Name: COLUMN launch_kits.assets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.launch_kits.assets IS 'Generated assets: landingPage, ads[], emails, socialPosts[], deck';


--
-- Name: COLUMN launch_kits.compliance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.launch_kits.compliance IS 'Compliance summary with claim counts and risk score';


--
-- Name: learned_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learned_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    generation_id uuid NOT NULL,
    acceptance_score double precision NOT NULL,
    user_feedback text,
    promoted_to_library boolean DEFAULT false,
    promoted_at timestamp with time zone,
    promoted_template_id uuid,
    review_status text DEFAULT 'pending'::text,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT learned_sections_review_status_check CHECK ((review_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: legal_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.legal_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    brand_id uuid,
    rule_type text NOT NULL,
    rule_text text NOT NULL,
    severity text DEFAULT 'warn'::text NOT NULL,
    applies_to_channels text[] DEFAULT '{}'::text[] NOT NULL,
    applies_to_regions text[] DEFAULT '{}'::text[] NOT NULL,
    required_disclaimer text,
    source_id uuid,
    status text DEFAULT 'draft'::text NOT NULL,
    metadata_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT legal_rules_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warn'::text, 'block'::text]))),
    CONSTRAINT legal_rules_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'review_required'::text, 'archived'::text])))
);


--
-- Name: marketplace_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketplace_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid,
    creator_id uuid,
    creator_name text,
    is_official boolean DEFAULT false,
    title text NOT NULL,
    description text,
    long_description text,
    category text NOT NULL,
    subcategory text,
    industry text,
    use_case text,
    tags text[] DEFAULT '{}'::text[],
    template_data jsonb NOT NULL,
    preview_data jsonb,
    preview_url text,
    thumbnail_url text,
    gallery_images text[] DEFAULT '{}'::text[],
    video_preview_url text,
    price_cents integer DEFAULT 0,
    currency text DEFAULT 'USD'::text,
    is_free boolean GENERATED ALWAYS AS ((price_cents = 0)) STORED,
    is_verified boolean DEFAULT false,
    is_featured boolean DEFAULT false,
    quality_score integer,
    usage_count integer DEFAULT 0,
    view_count integer DEFAULT 0,
    rating_avg numeric(3,2),
    rating_count integer DEFAULT 0,
    status text DEFAULT 'draft'::text,
    rejection_reason text,
    required_integrations text[] DEFAULT '{}'::text[],
    minimum_plan text,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: memory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    content_type text NOT NULL,
    content text NOT NULL,
    content_hash text NOT NULL,
    embedding public.vector(1536),
    context jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'pending'::text,
    feedback_score integer DEFAULT 0,
    feedback_reasons jsonb DEFAULT '[]'::jsonb,
    performance jsonb DEFAULT '{}'::jsonb,
    source_type text DEFAULT 'generated'::text,
    source_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_used_at timestamp with time zone,
    CONSTRAINT valid_content_type CHECK ((content_type = ANY (ARRAY['claim'::text, 'headline'::text, 'paragraph'::text, 'email'::text, 'ad'::text, 'social'::text, 'other'::text]))),
    CONSTRAINT valid_status CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: TABLE memory_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.memory_items IS 'Production memory for self-improving content generation';


--
-- Name: COLUMN memory_items.embedding; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.memory_items.embedding IS '1536-dimensional vector from text-embedding-3-large';


--
-- Name: COLUMN memory_items.feedback_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.memory_items.feedback_score IS 'Score from -100 (rejected) to 100 (highly approved)';


--
-- Name: COLUMN memory_items.performance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.memory_items.performance IS 'Performance metrics like clicks, conversions, engagement';


--
-- Name: message_evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_evidence (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    message_id uuid,
    evidence_id uuid,
    note text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    campaign_id uuid,
    type text NOT NULL,
    text text NOT NULL,
    status text DEFAULT 'approved'::text,
    strength text DEFAULT 'soft'::text,
    risk_tags text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    claim_id uuid,
    CONSTRAINT messages_status_check CHECK ((status = ANY (ARRAY['approved'::text, 'needs_evidence'::text, 'blocked'::text]))),
    CONSTRAINT messages_strength_check CHECK ((strength = ANY (ARRAY['hard'::text, 'soft'::text]))),
    CONSTRAINT messages_type_check CHECK ((type = ANY (ARRAY['headline'::text, 'supporting'::text, 'cta'::text, 'disclaimer'::text])))
);


--
-- Name: newsletter_ab_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.newsletter_ab_tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    newsletter_id uuid NOT NULL,
    name text NOT NULL,
    variant_a jsonb NOT NULL,
    variant_b jsonb NOT NULL,
    test_type text NOT NULL,
    sample_size_percent integer DEFAULT 20,
    winner_metric text DEFAULT 'open_rate'::text,
    status text DEFAULT 'pending'::text,
    winner text,
    variant_a_stats jsonb DEFAULT '{}'::jsonb,
    variant_b_stats jsonb DEFAULT '{}'::jsonb,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: newsletter_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.newsletter_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    category text DEFAULT 'custom'::text NOT NULL,
    thumbnail_url text,
    subject_template text,
    preheader_template text,
    sections jsonb DEFAULT '[]'::jsonb NOT NULL,
    color_scheme jsonb DEFAULT '{}'::jsonb NOT NULL,
    typography jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_public boolean DEFAULT false,
    is_featured boolean DEFAULT false,
    usage_count integer DEFAULT 0,
    tags text[] DEFAULT '{}'::text[],
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: newsletters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.newsletters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    brand_id uuid,
    topic text NOT NULL,
    audience text,
    tone text DEFAULT 'professional'::text,
    goal text DEFAULT 'engagement'::text,
    subject_lines text[],
    preheaders text[],
    content jsonb NOT NULL,
    designs jsonb DEFAULT '[]'::jsonb,
    claims text[],
    status text DEFAULT 'draft'::text,
    scheduled_at timestamp with time zone,
    sent_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT newsletters_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'sent'::text, 'archived'::text])))
);


--
-- Name: page_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.page_blocks (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    campaign_id uuid,
    angle_id uuid,
    type text NOT NULL,
    "order" integer DEFAULT 0,
    props jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT page_blocks_type_check CHECK ((type = ANY (ARRAY['hero'::text, 'trust'::text, 'benefits'::text, 'features'::text, 'pricing'::text, 'faq'::text, 'footer'::text, 'footer_cta'::text, 'testimonials'::text, 'cta'::text, 'stats'::text, 'comparison'::text, 'logos'::text, 'about'::text, 'contact'::text, 'team'::text, 'gallery'::text, 'process'::text, 'custom'::text])))
);


--
-- Name: page_transitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.page_transitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    direction text,
    duration integer DEFAULT 300,
    easing text DEFAULT 'ease-in-out'::text,
    css_enter text,
    css_exit text,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: page_view_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.page_view_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    published_page_id uuid NOT NULL,
    referrer text,
    user_agent text,
    country text,
    device_type text,
    viewed_at timestamp with time zone DEFAULT now()
);


--
-- Name: performance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.performance (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    campaign_id uuid,
    deployment_id uuid,
    captured_at timestamp with time zone DEFAULT now(),
    metrics jsonb DEFAULT '{}'::jsonb,
    notes jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    category text NOT NULL
);


--
-- Name: policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policies (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    workspace_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    mode text DEFAULT 'standard'::text NOT NULL,
    forbidden_terms jsonb DEFAULT '[]'::jsonb,
    regulated_categories jsonb DEFAULT '{"legal": true, "health": true, "finance": true, "security": true}'::jsonb,
    superlative_rules jsonb DEFAULT '{"block_without_proof": ["best", "#1", "only", "fastest", "leading", "top"], "require_evidence_tier": "A"}'::jsonb,
    evidence_requirements jsonb DEFAULT '{"generic": "C", "pricing": "C", "security": "A", "compliance": "A", "performance": "B"}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    template_id text,
    template_name text,
    CONSTRAINT policies_mode_check CHECK ((mode = ANY (ARRAY['standard'::text, 'strict'::text])))
);


--
-- Name: positioning_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.positioning_suggestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    category text NOT NULL,
    current_position text,
    suggested_position text,
    rationale text,
    messaging_angles text[] DEFAULT '{}'::text[],
    competitor_ids uuid[] DEFAULT '{}'::uuid[],
    status text DEFAULT 'pending'::text,
    generated_at timestamp with time zone DEFAULT now(),
    implemented_at timestamp with time zone,
    CONSTRAINT positioning_suggestions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'implemented'::text])))
);


--
-- Name: TABLE positioning_suggestions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.positioning_suggestions IS 'AI-generated positioning recommendations';


--
-- Name: private_chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.private_chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chat_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    message_type text DEFAULT 'text'::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_edited boolean DEFAULT false,
    edited_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: private_chats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.private_chats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    project_id uuid,
    name text,
    description text,
    participants uuid[] DEFAULT '{}'::uuid[],
    is_archived boolean DEFAULT false,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: product_facts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_facts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    brand_id uuid,
    fact_key text NOT NULL,
    statement text NOT NULL,
    category text DEFAULT 'generic'::text NOT NULL,
    source_id uuid,
    confidence numeric(4,3) DEFAULT 0.5 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    claimable boolean DEFAULT false NOT NULL,
    effective_region text,
    metadata_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    confirmed_by uuid,
    confirmed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_facts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'review_required'::text, 'conflicted'::text, 'archived'::text])))
);


--
-- Name: project_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    position_x double precision DEFAULT 0,
    position_y double precision DEFAULT 0,
    width double precision DEFAULT 300,
    height double precision DEFAULT 200,
    content jsonb DEFAULT '{}'::jsonb,
    html text,
    brand_id_override uuid,
    audience_id_override uuid,
    tone_override text,
    custom_instructions text,
    status text DEFAULT 'draft'::text,
    connected_to uuid[] DEFAULT '{}'::uuid[],
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: project_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'editor'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: project_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    slug text DEFAULT ''::text NOT NULL,
    is_home boolean DEFAULT false,
    blocks jsonb DEFAULT '[]'::jsonb,
    seo_title text,
    seo_description text,
    og_image text,
    transition text DEFAULT 'fade'::text,
    "order" integer DEFAULT 0,
    status text DEFAULT 'draft'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT project_pages_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])))
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    icon text,
    color text DEFAULT '#6366f1'::text,
    canvas_id uuid,
    brand_id uuid,
    audience_id uuid,
    campaign_goals text,
    tone_override text,
    keywords_include text[] DEFAULT '{}'::text[],
    keywords_avoid text[] DEFAULT '{}'::text[],
    custom_instructions text,
    status text DEFAULT 'active'::text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_multipage boolean DEFAULT false,
    default_transition text DEFAULT 'fade'::text
);


--
-- Name: provider_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    provider_id text NOT NULL,
    access_token_encrypted text,
    refresh_token_encrypted text,
    expires_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: provider_health_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_health_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    provider_type text NOT NULL,
    connection_id uuid,
    status text NOT NULL,
    response_time_ms integer,
    is_connected boolean,
    is_authenticated boolean,
    api_quota_remaining integer,
    api_quota_total integer,
    error_code text,
    error_message text,
    capabilities_status jsonb DEFAULT '{}'::jsonb,
    checked_at timestamp with time zone DEFAULT now()
);


--
-- Name: provider_health_summary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_health_summary (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    provider_type text NOT NULL,
    current_status text DEFAULT 'unknown'::text NOT NULL,
    last_healthy_at timestamp with time zone,
    last_error_at timestamp with time zone,
    last_error_message text,
    uptime_percent_30d numeric(5,2),
    avg_response_time_ms integer,
    error_count_24h integer DEFAULT 0,
    check_interval_minutes integer DEFAULT 15,
    last_check_at timestamp with time zone,
    next_check_at timestamp with time zone,
    alert_threshold_minutes integer DEFAULT 30,
    alert_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: provider_incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    provider_type text NOT NULL,
    title text NOT NULL,
    description text,
    severity text DEFAULT 'medium'::text,
    status text DEFAULT 'active'::text,
    affected_capabilities text[] DEFAULT '{}'::text[],
    resolution_notes text,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    started_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: public_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.public_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    long_description text,
    creator_name text,
    creator_company text,
    creator_website text,
    show_creator boolean DEFAULT true,
    industry text,
    campaign_type text,
    content_types text[] DEFAULT '{}'::text[],
    tags text[] DEFAULT '{}'::text[],
    thumbnail_url text,
    preview_images text[] DEFAULT '{}'::text[],
    results_summary text,
    key_learnings text[] DEFAULT '{}'::text[],
    is_featured boolean DEFAULT false,
    feature_order integer,
    usage_count integer DEFAULT 0,
    view_count integer DEFAULT 0,
    like_count integer DEFAULT 0,
    rating_avg numeric(3,2),
    rating_count integer DEFAULT 0,
    status text DEFAULT 'pending'::text,
    rejection_reason text,
    is_approved boolean DEFAULT false,
    approved_by uuid,
    approved_at timestamp with time zone,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: published_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.published_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    project_id uuid,
    page_id uuid,
    slug text NOT NULL,
    custom_domain text,
    title text NOT NULL,
    description text,
    html text NOT NULL,
    css text,
    og_image text,
    is_password_protected boolean DEFAULT false,
    password_hash text,
    analytics_enabled boolean DEFAULT true,
    view_count integer DEFAULT 0,
    last_viewed_at timestamp with time zone,
    status text DEFAULT 'active'::text,
    published_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    CONSTRAINT published_pages_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'expired'::text])))
);


--
-- Name: TABLE published_pages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.published_pages IS 'HTML content for subdomain deployments';


--
-- Name: published_sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.published_sites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    design_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    subdomain text NOT NULL,
    custom_domain text,
    full_url text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    ssl_status text DEFAULT 'pending'::text NOT NULL,
    is_password_protected boolean DEFAULT false,
    password_hash text,
    version integer DEFAULT 1,
    published_at timestamp with time zone DEFAULT now(),
    view_count integer DEFAULT 0,
    unique_visitors integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT valid_ssl_status CHECK ((ssl_status = ANY (ARRAY['pending'::text, 'provisioning'::text, 'active'::text, 'error'::text]))),
    CONSTRAINT valid_status CHECK ((status = ANY (ARRAY['pending'::text, 'provisioning'::text, 'active'::text, 'error'::text])))
);


--
-- Name: requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    requester_id uuid NOT NULL,
    assignee_id uuid,
    asset_type text NOT NULL,
    title text NOT NULL,
    brief jsonb DEFAULT '{}'::jsonb NOT NULL,
    priority text DEFAULT 'normal'::text,
    due_date timestamp with time zone,
    status text DEFAULT 'new'::text,
    kit_id uuid,
    feedback jsonb DEFAULT '[]'::jsonb,
    source text DEFAULT 'app'::text,
    source_metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    CONSTRAINT valid_asset_type CHECK ((asset_type = ANY (ARRAY['landing_page'::text, 'ads'::text, 'emails'::text, 'deck'::text, 'social'::text, 'other'::text]))),
    CONSTRAINT valid_priority CHECK ((priority = ANY (ARRAY['urgent'::text, 'normal'::text, 'low'::text]))),
    CONSTRAINT valid_status CHECK ((status = ANY (ARRAY['new'::text, 'in_progress'::text, 'review'::text, 'approved'::text, 'done'::text, 'cancelled'::text])))
);


--
-- Name: TABLE requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.requests IS 'Team request workflow for marketing asset generation';


--
-- Name: COLUMN requests.brief; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.requests.brief IS 'Request brief containing audience, offer, and constraints';


--
-- Name: COLUMN requests.feedback; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.requests.feedback IS 'Array of feedback entries with user_id, content, and timestamp';


--
-- Name: COLUMN requests.source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.requests.source IS 'Where the request originated (app, slack, email, api)';


--
-- Name: sako_task_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sako_task_activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    type text NOT NULL,
    content text,
    metadata jsonb DEFAULT '{}'::jsonb,
    user_id uuid,
    user_name text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sako_task_activity_type_check CHECK ((type = ANY (ARRAY['comment'::text, 'status_change'::text, 'assignment'::text, 'delivery'::text])))
);


--
-- Name: sako_tasks_with_campaign; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.sako_tasks_with_campaign AS
 SELECT t.id,
    t.campaign_id,
    t.workspace_id,
    t.brand_id,
    t.sako_v1_id,
    t.type,
    t.status,
    t.priority,
    t.brief,
    t.reason,
    t.current_html,
    t.feedback,
    t.assigned_to,
    t.estimated_delivery,
    t.deliverables,
    t.created_at,
    t.updated_at,
    c.name AS campaign_name,
    c.status AS campaign_status,
    b.name AS brand_name
   FROM ((public.sako_tasks t
     LEFT JOIN public.campaigns c ON ((c.id = t.campaign_id)))
     LEFT JOIN public.brands b ON ((b.id = t.brand_id)));


--
-- Name: saved_ad_creatives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_ad_creatives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    campaign_id uuid,
    name text NOT NULL,
    platform text NOT NULL,
    format text NOT NULL,
    variant_label text DEFAULT 'A'::text,
    primary_text text,
    headline text,
    description text,
    call_to_action text,
    media_urls text[] DEFAULT '{}'::text[],
    thumbnail_url text,
    slides jsonb,
    script jsonb,
    hashtags text[] DEFAULT '{}'::text[],
    claims text[] DEFAULT '{}'::text[],
    archetype text,
    dimensions jsonb,
    duration integer,
    ai_generated boolean DEFAULT true,
    generation_metadata jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'draft'::text,
    performance_metrics jsonb DEFAULT '{}'::jsonb,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: saved_newsletters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_newsletters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    template_id uuid,
    campaign_id uuid,
    name text NOT NULL,
    subject text NOT NULL,
    preheader text,
    content jsonb NOT NULL,
    html_content text,
    status text DEFAULT 'draft'::text,
    scheduled_at timestamp with time zone,
    sent_at timestamp with time zone,
    recipient_count integer,
    open_rate numeric(5,2),
    click_rate numeric(5,2),
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: scheduled_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_content (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    automation_rule_id uuid,
    workspace_id uuid NOT NULL,
    asset_document_id uuid,
    scheduled_for timestamp with time zone,
    status text DEFAULT 'pending_review'::text,
    approved_by uuid,
    approved_at timestamp with time zone,
    published_at timestamp with time zone,
    rejection_reason text,
    metrics_json jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT scheduled_content_status_check CHECK ((status = ANY (ARRAY['pending_review'::text, 'approved'::text, 'published'::text, 'rejected'::text, 'failed'::text])))
);


--
-- Name: section_analytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.section_analytics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    date date NOT NULL,
    times_retrieved integer DEFAULT 0,
    times_selected integer DEFAULT 0,
    times_accepted integer DEFAULT 0,
    times_edited integer DEFAULT 0,
    times_rejected integer DEFAULT 0,
    avg_edit_distance double precision,
    avg_generation_time_ms double precision,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: share_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.share_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    share_token_id uuid NOT NULL,
    content text NOT NULL,
    section_id text,
    commenter_name text,
    commenter_email text,
    is_resolved boolean DEFAULT false,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    parent_comment_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: share_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.share_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    code text NOT NULL,
    expires_at timestamp with time zone,
    max_views integer,
    view_count integer DEFAULT 0,
    is_password_protected boolean DEFAULT false,
    password_hash text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: share_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.share_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    campaign_id uuid NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone,
    password_hash text,
    allowed_emails text[] DEFAULT '{}'::text[],
    max_views integer,
    view_tracking boolean DEFAULT true,
    collect_email boolean DEFAULT false,
    show_claims boolean DEFAULT true,
    show_evidence boolean DEFAULT true,
    show_analytics boolean DEFAULT false,
    allow_comments boolean DEFAULT false,
    custom_title text,
    custom_message text,
    hide_sako_branding boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    last_viewed_at timestamp with time zone
);


--
-- Name: share_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.share_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    share_token_id uuid NOT NULL,
    viewer_ip text,
    viewer_user_agent text,
    viewer_email text,
    session_id text,
    referrer text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    view_duration_seconds integer,
    scroll_depth_percent integer,
    sections_viewed text[] DEFAULT '{}'::text[],
    device_type text,
    browser text,
    os text,
    country text,
    city text,
    viewed_at timestamp with time zone DEFAULT now(),
    last_interaction_at timestamp with time zone
);


--
-- Name: slack_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slack_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slack_user_id text NOT NULL,
    slack_team_id text NOT NULL,
    user_id uuid,
    workspace_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE slack_users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.slack_users IS 'Mapping between Slack users and Sako users';


--
-- Name: snippet_favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.snippet_favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    snippet_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: snippets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.snippets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid,
    name text NOT NULL,
    description text,
    type text NOT NULL,
    category text,
    html text,
    css text,
    js text,
    thumbnail_url text,
    preview_url text,
    is_public boolean DEFAULT false,
    usage_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: social_calendars; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_calendars (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    brand_id uuid,
    name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    platforms text[] DEFAULT '{}'::text[],
    content_pillars jsonb DEFAULT '[]'::jsonb,
    posting_frequency jsonb DEFAULT '{}'::jsonb,
    optimal_times jsonb DEFAULT '{}'::jsonb,
    posts jsonb DEFAULT '[]'::jsonb,
    total_posts integer DEFAULT 0,
    scheduled_posts integer DEFAULT 0,
    published_posts integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: social_post_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_post_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid,
    platform text NOT NULL,
    variant_label text DEFAULT 'A'::text,
    content text NOT NULL,
    hashtags text[] DEFAULT '{}'::text[],
    character_count integer,
    image_prompt text,
    image_url text,
    image_sizes text[] DEFAULT '{}'::text[],
    is_thread boolean DEFAULT false,
    thread_parts text[] DEFAULT '{}'::text[],
    impressions integer DEFAULT 0,
    engagements integer DEFAULT 0,
    clicks integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT social_post_variants_platform_check CHECK ((platform = ANY (ARRAY['linkedin'::text, 'twitter'::text, 'facebook'::text, 'instagram'::text, 'tiktok'::text])))
);


--
-- Name: TABLE social_post_variants; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.social_post_variants IS 'Platform-specific social post variants with A/B testing support';


--
-- Name: social_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    calendar_id uuid,
    workspace_id uuid NOT NULL,
    brand_id uuid,
    scheduled_date date NOT NULL,
    scheduled_time time without time zone NOT NULL,
    platform text NOT NULL,
    content_type text NOT NULL,
    theme text,
    caption text NOT NULL,
    hashtags text[] DEFAULT '{}'::text[],
    call_to_action text,
    visual_direction text,
    media_urls text[] DEFAULT '{}'::text[],
    thumbnail_url text,
    status text DEFAULT 'draft'::text,
    published_at timestamp with time zone,
    publish_error text,
    external_post_id text,
    external_post_url text,
    likes integer DEFAULT 0,
    comments integer DEFAULT 0,
    shares integer DEFAULT 0,
    impressions integer DEFAULT 0,
    reach integer DEFAULT 0,
    engagement_rate numeric(5,4) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: sso_configurations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sso_configurations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    provider text NOT NULL,
    enabled boolean DEFAULT false,
    entity_id text,
    sso_url text,
    slo_url text,
    certificate text,
    client_id text,
    client_secret_encrypted text,
    discovery_url text,
    allowed_domains text[] DEFAULT '{}'::text[],
    auto_provision_users boolean DEFAULT true,
    default_role text DEFAULT 'member'::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sso_configurations_provider_check CHECK ((provider = ANY (ARRAY['saml'::text, 'oidc'::text, 'okta'::text, 'azure_ad'::text, 'google_workspace'::text])))
);


--
-- Name: studio_app_favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_app_favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    app_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: studio_app_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_app_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    app_id uuid NOT NULL,
    user_id uuid,
    inputs jsonb NOT NULL,
    output text,
    model text NOT NULL,
    tokens_used integer,
    latency_ms integer,
    brand_id uuid,
    audience_id uuid,
    knowledge_items uuid[] DEFAULT '{}'::uuid[],
    status text DEFAULT 'completed'::text,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT studio_app_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: studio_apps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_apps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    icon text DEFAULT '🤖'::text,
    category text DEFAULT 'custom'::text,
    inputs jsonb DEFAULT '[]'::jsonb,
    instructions text NOT NULL,
    example_output text,
    model text DEFAULT 'openai/gpt-5.2-chat'::text NOT NULL,
    temperature numeric(3,2) DEFAULT 0.7,
    max_tokens integer,
    knowledge_items uuid[] DEFAULT '{}'::uuid[],
    default_brand_id uuid,
    default_audience_id uuid,
    visibility text DEFAULT 'private'::text,
    published_at timestamp with time zone,
    run_count integer DEFAULT 0,
    last_run_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT studio_apps_temperature_check CHECK (((temperature >= (0)::numeric) AND (temperature <= (1)::numeric))),
    CONSTRAINT studio_apps_visibility_check CHECK ((visibility = ANY (ARRAY['private'::text, 'workspace'::text, 'public'::text])))
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    plan_id text DEFAULT 'free'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'canceled'::text, 'past_due'::text, 'trialing'::text])))
);


--
-- Name: supported_languages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supported_languages (
    code text NOT NULL,
    name text NOT NULL,
    native_name text,
    direction text DEFAULT 'ltr'::text,
    is_active boolean DEFAULT true,
    tier text DEFAULT 'standard'::text
);


--
-- Name: task_composer_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_composer_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    task_id uuid NOT NULL,
    document_id uuid,
    version_id uuid,
    html_content text,
    json_content jsonb DEFAULT '{}'::jsonb NOT NULL,
    preview_url text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: team_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_sessions (
    id text NOT NULL,
    workspace_id uuid NOT NULL,
    input_url text NOT NULL,
    brand_data jsonb,
    agent_states jsonb DEFAULT '{}'::jsonb,
    current_phase text DEFAULT 'import'::text NOT NULL,
    approval_request_id text,
    output_data jsonb,
    deployed_to text[] DEFAULT '{}'::text[],
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    error_message text,
    created_by uuid NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT team_sessions_current_phase_check CHECK ((current_phase = ANY (ARRAY['import'::text, 'scout'::text, 'guardian'::text, 'review'::text, 'creator'::text, 'architect'::text, 'ops'::text, 'ready'::text, 'deployed'::text, 'error'::text])))
);


--
-- Name: TABLE team_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.team_sessions IS 'Tracks multi-agent team orchestration sessions for the AI Marketing Team feature';


--
-- Name: COLUMN team_sessions.brand_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_sessions.brand_data IS 'Extracted brand context passed to agents (name, industry, colors, voice, claims)';


--
-- Name: COLUMN team_sessions.agent_states; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_sessions.agent_states IS 'JSON object tracking each agent completion status and output summaries';


--
-- Name: COLUMN team_sessions.current_phase; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_sessions.current_phase IS 'Current stage in the agent pipeline: import→scout→guardian→review→creator→architect→ops→ready→deployed';


--
-- Name: COLUMN team_sessions.output_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_sessions.output_data IS 'Final campaign output including landing page, emails, social posts, quality signals';


--
-- Name: COLUMN team_sessions.deployed_to; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_sessions.deployed_to IS 'Array of provider names where campaign was deployed';


--
-- Name: template_acquisitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.template_acquisitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    template_id uuid NOT NULL,
    user_id uuid,
    price_paid_cents integer DEFAULT 0,
    currency text DEFAULT 'USD'::text,
    payment_intent_id text,
    status text DEFAULT 'completed'::text,
    acquired_at timestamp with time zone DEFAULT now()
);


--
-- Name: template_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.template_purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    user_id uuid NOT NULL,
    payment_intent_id text,
    purchased_at timestamp with time zone DEFAULT now()
);


--
-- Name: template_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.template_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid,
    rating integer NOT NULL,
    title text,
    content text,
    helpful_count integer DEFAULT 0,
    is_verified_purchase boolean DEFAULT false,
    is_visible boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT template_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    category text NOT NULL,
    thumbnail_url text,
    preview_url text,
    tier text DEFAULT 'free'::text NOT NULL,
    price integer,
    creator_id uuid,
    creator_name text,
    creator_avatar text,
    structure jsonb DEFAULT '{}'::jsonb NOT NULL,
    usage_count integer DEFAULT 0,
    rating numeric(2,1),
    review_count integer DEFAULT 0,
    tags text[] DEFAULT '{}'::text[],
    is_public boolean DEFAULT false,
    is_featured boolean DEFAULT false,
    is_new boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT valid_tier CHECK ((tier = ANY (ARRAY['free'::text, 'pro'::text, 'paid'::text])))
);


--
-- Name: ui_components; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ui_components (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid,
    name text NOT NULL,
    description text,
    category text NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    thumbnail_url text,
    preview_html text,
    html text NOT NULL,
    css text,
    js text,
    styles jsonb DEFAULT '{}'::jsonb,
    variants jsonb DEFAULT '[]'::jsonb,
    is_pro boolean DEFAULT false,
    is_public boolean DEFAULT false,
    is_system boolean DEFAULT false,
    usage_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: usage_aggregates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage_aggregates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    ai_generations integer DEFAULT 0,
    ai_tokens_used bigint DEFAULT 0,
    deployments integer DEFAULT 0,
    api_calls integer DEFAULT 0,
    exports integer DEFAULT 0,
    sako_tasks integer DEFAULT 0,
    total_cost_usd double precision DEFAULT 0,
    ai_generation_limit integer,
    deployment_limit integer,
    api_call_limit integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: usage_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id text,
    event_type text NOT NULL,
    event_subtype text,
    resource_type text,
    resource_id text,
    units_consumed integer DEFAULT 1,
    tokens_used integer,
    cost_usd double precision,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: usage_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    metric_type text NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT usage_metrics_metric_type_check CHECK ((metric_type = ANY (ARRAY['campaigns'::text, 'api_calls'::text, 'deployments'::text])))
);


--
-- Name: user_saved_components; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_saved_components (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    component_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_snippets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_snippets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    snippet_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: video_scenes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video_scenes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    script_id uuid,
    scene_order integer NOT NULL,
    duration integer NOT NULL,
    narration text NOT NULL,
    visual_direction text,
    text_overlay text,
    broll_keywords text[] DEFAULT '{}'::text[],
    broll_url text,
    transition text DEFAULT 'cut'::text,
    claim_ids uuid[] DEFAULT '{}'::uuid[],
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT video_scenes_transition_check CHECK ((transition = ANY (ARRAY['cut'::text, 'fade'::text, 'slide'::text, 'zoom'::text, 'wipe'::text])))
);


--
-- Name: TABLE video_scenes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.video_scenes IS 'Individual scenes within a video script';


--
-- Name: video_scripts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video_scripts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid,
    format text NOT NULL,
    style text DEFAULT 'explainer'::text,
    total_duration integer,
    voiceover_text text,
    music_mood text,
    estimated_cost numeric(10,2),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT video_scripts_format_check CHECK ((format = ANY (ARRAY['16:9'::text, '9:16'::text, '1:1'::text]))),
    CONSTRAINT video_scripts_style_check CHECK ((style = ANY (ARRAY['explainer'::text, 'testimonial'::text, 'product'::text, 'brand'::text, 'announcement'::text])))
);


--
-- Name: TABLE video_scripts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.video_scripts IS 'Video script metadata and full voiceover text';


--
-- Name: voiceovers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voiceovers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    script_id uuid,
    provider text DEFAULT 'elevenlabs'::text,
    voice_id text NOT NULL,
    voice_name text,
    audio_url text NOT NULL,
    duration integer,
    speed numeric(3,2) DEFAULT 1.0,
    stability numeric(3,2),
    similarity_boost numeric(3,2),
    character_count integer,
    cost numeric(10,4),
    segments jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT voiceovers_provider_check CHECK ((provider = ANY (ARRAY['elevenlabs'::text, 'playht'::text, 'openai'::text, 'google'::text])))
);


--
-- Name: TABLE voiceovers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.voiceovers IS 'Generated voiceover audio files';


--
-- Name: wallet_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    type text NOT NULL,
    amount integer NOT NULL,
    model text,
    tokens integer,
    description text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wallet_transactions_type_check CHECK ((type = ANY (ARRAY['credit'::text, 'debit'::text, 'refund'::text, 'bonus'::text])))
);


--
-- Name: webhook_configurations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_configurations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    provider text NOT NULL,
    webhook_url text NOT NULL,
    secret text,
    events text[] DEFAULT '{}'::text[] NOT NULL,
    headers jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    last_triggered_at timestamp with time zone,
    trigger_count integer DEFAULT 0,
    failure_count integer DEFAULT 0,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: webhook_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    webhook_id uuid NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    response_status integer,
    response_body text,
    duration_ms integer,
    success boolean DEFAULT false,
    error_message text,
    retry_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: website_designs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.website_designs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    brand_id uuid,
    project_id uuid,
    name text NOT NULL,
    description text,
    sections jsonb DEFAULT '[]'::jsonb,
    global_styles jsonb DEFAULT '{}'::jsonb,
    seo_meta jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'draft'::text,
    published_url text,
    published_at timestamp with time zone,
    subdomain text,
    custom_domain text,
    version integer DEFAULT 1,
    last_edited_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    render_html text DEFAULT ''::text NOT NULL,
    render_manifest jsonb DEFAULT '{}'::jsonb NOT NULL,
    editor_mode text DEFAULT 'freeform'::text NOT NULL,
    CONSTRAINT website_designs_editor_mode_check CHECK ((editor_mode = ANY (ARRAY['freeform'::text, 'controlled'::text])))
);


--
-- Name: COLUMN website_designs.render_html; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.website_designs.render_html IS 'Canonical HTML artifact from generateLandingPage(). Authoritative for campaign-linked designs.';


--
-- Name: COLUMN website_designs.render_manifest; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.website_designs.render_manifest IS 'Generation metadata: archetype, designDirection, templateRefs, claims, isLegacyBackfill, generatedAt.';


--
-- Name: COLUMN website_designs.editor_mode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.website_designs.editor_mode IS '''freeform'' = generic section editor; ''controlled'' = campaign builder where edits trigger regeneration.';


--
-- Name: website_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.website_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    design_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    is_home boolean DEFAULT false,
    sections jsonb DEFAULT '[]'::jsonb,
    seo_meta jsonb DEFAULT '{}'::jsonb,
    page_transitions jsonb DEFAULT '{}'::jsonb,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: workflow_node_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_node_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    node_id text NOT NULL,
    node_type text NOT NULL,
    node_label text,
    status text DEFAULT 'pending'::text,
    input_data jsonb,
    output_data jsonb,
    error_message text,
    retry_count integer DEFAULT 0,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    duration_ms integer
);


--
-- Name: workflow_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workflow_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    trigger_type text NOT NULL,
    trigger_data jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'pending'::text,
    current_node_id text,
    nodes_completed text[] DEFAULT '{}'::text[],
    nodes_failed text[] DEFAULT '{}'::text[],
    execution_path text[] DEFAULT '{}'::text[],
    state jsonb DEFAULT '{}'::jsonb,
    paused_at_node text,
    paused_reason text,
    paused_at timestamp with time zone,
    resumed_by uuid,
    resumed_at timestamp with time zone,
    error_message text,
    error_node_id text,
    error_details jsonb,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    duration_ms integer,
    initiated_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: workflow_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    category text,
    nodes jsonb DEFAULT '[]'::jsonb NOT NULL,
    edges jsonb DEFAULT '[]'::jsonb NOT NULL,
    thumbnail_url text,
    is_official boolean DEFAULT false,
    usage_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: workflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    nodes jsonb DEFAULT '[]'::jsonb NOT NULL,
    edges jsonb DEFAULT '[]'::jsonb NOT NULL,
    viewport jsonb DEFAULT '{"x": 0, "y": 0, "zoom": 1}'::jsonb,
    compiled_graph jsonb,
    compiled_at timestamp with time zone,
    compilation_errors text[],
    trigger_type text DEFAULT 'manual'::text,
    trigger_config jsonb DEFAULT '{}'::jsonb,
    timeout_seconds integer DEFAULT 300,
    retry_config jsonb DEFAULT '{"max_attempts": 3, "backoff_multiplier": 2}'::jsonb,
    concurrency_limit integer DEFAULT 5,
    is_active boolean DEFAULT false,
    is_template boolean DEFAULT false,
    version integer DEFAULT 1,
    run_count integer DEFAULT 0,
    success_count integer DEFAULT 0,
    failure_count integer DEFAULT 0,
    avg_duration_ms integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    last_run_at timestamp with time zone
);


--
-- Name: workspace_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_members (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb,
    custom_role_id uuid,
    CONSTRAINT workspace_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'reviewer'::text, 'member'::text])))
);


--
-- Name: workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspaces (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    settings jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT check_onboarding_data CHECK (((settings IS NULL) OR ((settings ->> 'onboarding_completed'::text) IS NULL) OR ((settings ->> 'onboarding_completed'::text) = ANY (ARRAY['true'::text, 'false'::text]))))
);


--
-- Name: workspace_onboarding_status; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.workspace_onboarding_status AS
 SELECT id AS workspace_id,
    name AS workspace_name,
    COALESCE(((settings ->> 'onboarding_completed'::text))::boolean, false) AS onboarding_completed,
    (settings ->> 'industry'::text) AS industry,
    (settings ->> 'primaryGoal'::text) AS primary_goal,
    (settings -> 'selectedProviders'::text) AS selected_providers,
    (settings ->> 'defaultPolicyTemplate'::text) AS default_policy_template,
    ((settings ->> 'onboarding_completed_at'::text))::timestamp with time zone AS completed_at
   FROM public.workspaces w;


--
-- Name: VIEW workspace_onboarding_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.workspace_onboarding_status IS 'View for checking workspace onboarding status - inherits RLS from workspaces table';


--
-- Name: workspace_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_settings (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    workspace_id uuid,
    forbidden_phrases text[] DEFAULT '{}'::text[],
    brand_colors jsonb,
    brand_typography jsonb,
    brand_logo_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    industry text,
    brand_voice text,
    default_view text DEFAULT 'agent'::text,
    CONSTRAINT workspace_settings_default_view_check CHECK ((default_view = ANY (ARRAY['agent'::text, 'advanced'::text])))
);


--
-- Name: COLUMN workspace_settings.default_view; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_settings.default_view IS 'User interface preference: agent = chat-first simplified view, advanced = full sidebar with all features';


--
-- Name: workspace_wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_wallets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    balance integer DEFAULT 0 NOT NULL,
    low_balance_threshold integer DEFAULT 500 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: zapier_api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zapier_api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    key_hash text NOT NULL,
    key_prefix text NOT NULL,
    name text DEFAULT 'Zapier Integration'::text,
    scopes text[] DEFAULT ARRAY['campaigns:read'::text, 'campaigns:create'::text, 'claims:read'::text, 'claims:validate'::text],
    rate_limit_per_minute integer DEFAULT 60,
    is_active boolean DEFAULT true,
    last_used_at timestamp with time zone,
    usage_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone
);


--
-- Name: zapier_webhook_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zapier_webhook_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscription_id uuid NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'pending'::text,
    response_status integer,
    response_body text,
    retry_count integer DEFAULT 0,
    max_retries integer DEFAULT 3,
    next_retry_at timestamp with time zone,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: zapier_webhook_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zapier_webhook_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    webhook_url text NOT NULL,
    trigger_type text NOT NULL,
    filters jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    zapier_subscription_id text,
    delivery_count integer DEFAULT 0,
    last_delivery_at timestamp with time zone,
    last_error text,
    error_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ad_ab_tests ad_ab_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_ab_tests
    ADD CONSTRAINT ad_ab_tests_pkey PRIMARY KEY (id);


--
-- Name: ad_creative_versions ad_creative_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_creative_versions
    ADD CONSTRAINT ad_creative_versions_pkey PRIMARY KEY (id);


--
-- Name: ad_creatives ad_creatives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_creatives
    ADD CONSTRAINT ad_creatives_pkey PRIMARY KEY (id);


--
-- Name: ad_format_configs ad_format_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_format_configs
    ADD CONSTRAINT ad_format_configs_pkey PRIMARY KEY (id);


--
-- Name: affiliate_assets affiliate_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_assets
    ADD CONSTRAINT affiliate_assets_pkey PRIMARY KEY (id);


--
-- Name: affiliate_commissions affiliate_commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_commissions
    ADD CONSTRAINT affiliate_commissions_pkey PRIMARY KEY (id);


--
-- Name: affiliate_payouts affiliate_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_payouts
    ADD CONSTRAINT affiliate_payouts_pkey PRIMARY KEY (id);


--
-- Name: affiliate_referrals affiliate_referrals_cookie_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_referrals
    ADD CONSTRAINT affiliate_referrals_cookie_id_key UNIQUE (cookie_id);


--
-- Name: affiliate_referrals affiliate_referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_referrals
    ADD CONSTRAINT affiliate_referrals_pkey PRIMARY KEY (id);


--
-- Name: affiliates affiliates_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliates
    ADD CONSTRAINT affiliates_code_key UNIQUE (code);


--
-- Name: affiliates affiliates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliates
    ADD CONSTRAINT affiliates_pkey PRIMARY KEY (id);


--
-- Name: agent_runs agent_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_runs
    ADD CONSTRAINT agent_runs_pkey PRIMARY KEY (id);


--
-- Name: ai_traces ai_traces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_traces
    ADD CONSTRAINT ai_traces_pkey PRIMARY KEY (id);


--
-- Name: angles angles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.angles
    ADD CONSTRAINT angles_pkey PRIMARY KEY (id);


--
-- Name: api_keys api_keys_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_key_hash_key UNIQUE (key_hash);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: api_usage api_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_usage
    ADD CONSTRAINT api_usage_pkey PRIMARY KEY (id);


--
-- Name: approval_decisions approval_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_decisions
    ADD CONSTRAINT approval_decisions_pkey PRIMARY KEY (id);


--
-- Name: approval_instances approval_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_instances
    ADD CONSTRAINT approval_instances_pkey PRIMARY KEY (id);


--
-- Name: approval_requests approval_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_pkey PRIMARY KEY (id);


--
-- Name: approval_templates approval_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_templates
    ADD CONSTRAINT approval_templates_pkey PRIMARY KEY (id);


--
-- Name: approvals approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_pkey PRIMARY KEY (id);


--
-- Name: assembled_videos assembled_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assembled_videos
    ADD CONSTRAINT assembled_videos_pkey PRIMARY KEY (id);


--
-- Name: asset_comments asset_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_comments
    ADD CONSTRAINT asset_comments_pkey PRIMARY KEY (id);


--
-- Name: asset_documents asset_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_documents
    ADD CONSTRAINT asset_documents_pkey PRIMARY KEY (id);


--
-- Name: asset_renders asset_renders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_renders
    ADD CONSTRAINT asset_renders_pkey PRIMARY KEY (id);


--
-- Name: audiences audiences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audiences
    ADD CONSTRAINT audiences_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: automation_rules automation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_rules
    ADD CONSTRAINT automation_rules_pkey PRIMARY KEY (id);


--
-- Name: automation_runs automation_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_runs
    ADD CONSTRAINT automation_runs_pkey PRIMARY KEY (id);


--
-- Name: battle_cards battle_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.battle_cards
    ADD CONSTRAINT battle_cards_pkey PRIMARY KEY (id);


--
-- Name: bigquery_sync_configs bigquery_sync_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bigquery_sync_configs
    ADD CONSTRAINT bigquery_sync_configs_pkey PRIMARY KEY (id);


--
-- Name: bigquery_sync_history bigquery_sync_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bigquery_sync_history
    ADD CONSTRAINT bigquery_sync_history_pkey PRIMARY KEY (id);


--
-- Name: brain_learning_runs brain_learning_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_learning_runs
    ADD CONSTRAINT brain_learning_runs_pkey PRIMARY KEY (id);


--
-- Name: brain_snapshots brain_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_snapshots
    ADD CONSTRAINT brain_snapshots_pkey PRIMARY KEY (id);


--
-- Name: brain_sources brain_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_sources
    ADD CONSTRAINT brain_sources_pkey PRIMARY KEY (id);


--
-- Name: brain_sync_runs brain_sync_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_sync_runs
    ADD CONSTRAINT brain_sync_runs_pkey PRIMARY KEY (id);


--
-- Name: brand_assets brand_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_assets
    ADD CONSTRAINT brand_assets_pkey PRIMARY KEY (id);


--
-- Name: brand_memory brand_memory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_memory
    ADD CONSTRAINT brand_memory_pkey PRIMARY KEY (id);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: budget_alert_history budget_alert_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_alert_history
    ADD CONSTRAINT budget_alert_history_pkey PRIMARY KEY (id);


--
-- Name: budget_alerts budget_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_alerts
    ADD CONSTRAINT budget_alerts_pkey PRIMARY KEY (id);


--
-- Name: campaign_assets campaign_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_assets
    ADD CONSTRAINT campaign_assets_pkey PRIMARY KEY (id);


--
-- Name: campaign_claim_links campaign_claim_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_claim_links
    ADD CONSTRAINT campaign_claim_links_pkey PRIMARY KEY (id);


--
-- Name: campaign_fact_citations campaign_fact_citations_campaign_id_fact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_fact_citations
    ADD CONSTRAINT campaign_fact_citations_campaign_id_fact_id_key UNIQUE (campaign_id, fact_id);


--
-- Name: campaign_fact_citations campaign_fact_citations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_fact_citations
    ADD CONSTRAINT campaign_fact_citations_pkey PRIMARY KEY (id);


--
-- Name: campaign_targeting_rules campaign_targeting_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_targeting_rules
    ADD CONSTRAINT campaign_targeting_rules_pkey PRIMARY KEY (id);


--
-- Name: campaign_versions campaign_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_versions
    ADD CONSTRAINT campaign_versions_pkey PRIMARY KEY (id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: campaigns campaigns_tracking_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_tracking_id_key UNIQUE (tracking_id);


--
-- Name: cancellation_feedback cancellation_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cancellation_feedback
    ADD CONSTRAINT cancellation_feedback_pkey PRIMARY KEY (id);


--
-- Name: canvas_comments canvas_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_comments
    ADD CONSTRAINT canvas_comments_pkey PRIMARY KEY (id);


--
-- Name: canvas_elements canvas_elements_canvas_id_element_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_elements
    ADD CONSTRAINT canvas_elements_canvas_id_element_id_key UNIQUE (canvas_id, element_id);


--
-- Name: canvas_elements canvas_elements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_elements
    ADD CONSTRAINT canvas_elements_pkey PRIMARY KEY (id);


--
-- Name: canvas_presence canvas_presence_canvas_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_presence
    ADD CONSTRAINT canvas_presence_canvas_id_user_id_key UNIQUE (canvas_id, user_id);


--
-- Name: canvas_presence canvas_presence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_presence
    ADD CONSTRAINT canvas_presence_pkey PRIMARY KEY (id);


--
-- Name: canvas_versions canvas_versions_canvas_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_versions
    ADD CONSTRAINT canvas_versions_canvas_id_version_number_key UNIQUE (canvas_id, version_number);


--
-- Name: canvas_versions canvas_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_versions
    ADD CONSTRAINT canvas_versions_pkey PRIMARY KEY (id);


--
-- Name: canvases canvases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvases
    ADD CONSTRAINT canvases_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_sessions chat_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_pkey PRIMARY KEY (id);


--
-- Name: claim_evidence_links claim_evidence_links_claim_id_evidence_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_evidence_links
    ADD CONSTRAINT claim_evidence_links_claim_id_evidence_id_key UNIQUE (claim_id, evidence_id);


--
-- Name: claim_evidence_links claim_evidence_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_evidence_links
    ADD CONSTRAINT claim_evidence_links_pkey PRIMARY KEY (id);


--
-- Name: claim_packs claim_packs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_packs
    ADD CONSTRAINT claim_packs_pkey PRIMARY KEY (id);


--
-- Name: claim_packs claim_packs_share_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_packs
    ADD CONSTRAINT claim_packs_share_token_key UNIQUE (share_token);


--
-- Name: claim_performance claim_performance_claim_hash_workspace_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_performance
    ADD CONSTRAINT claim_performance_claim_hash_workspace_id_key UNIQUE (claim_hash, workspace_id);


--
-- Name: claim_performance claim_performance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_performance
    ADD CONSTRAINT claim_performance_pkey PRIMARY KEY (id);


--
-- Name: claims claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_pkey PRIMARY KEY (id);


--
-- Name: comment_notifications comment_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comment_notifications
    ADD CONSTRAINT comment_notifications_pkey PRIMARY KEY (id);


--
-- Name: comment_reactions comment_reactions_comment_id_user_id_reaction_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comment_reactions
    ADD CONSTRAINT comment_reactions_comment_id_user_id_reaction_key UNIQUE (comment_id, user_id, reaction);


--
-- Name: comment_reactions comment_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comment_reactions
    ADD CONSTRAINT comment_reactions_pkey PRIMARY KEY (id);


--
-- Name: competitors competitors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitors
    ADD CONSTRAINT competitors_pkey PRIMARY KEY (id);


--
-- Name: competitors competitors_workspace_id_domain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitors
    ADD CONSTRAINT competitors_workspace_id_domain_key UNIQUE (workspace_id, domain);


--
-- Name: compliance_reports compliance_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_reports
    ADD CONSTRAINT compliance_reports_pkey PRIMARY KEY (id);


--
-- Name: compliance_reports compliance_reports_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_reports
    ADD CONSTRAINT compliance_reports_token_key UNIQUE (token);


--
-- Name: component_categories component_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_categories
    ADD CONSTRAINT component_categories_pkey PRIMARY KEY (id);


--
-- Name: composer_document_versions composer_document_versions_document_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_document_versions
    ADD CONSTRAINT composer_document_versions_document_id_version_number_key UNIQUE (document_id, version_number);


--
-- Name: composer_document_versions composer_document_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_document_versions
    ADD CONSTRAINT composer_document_versions_pkey PRIMARY KEY (id);


--
-- Name: composer_documents composer_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_documents
    ADD CONSTRAINT composer_documents_pkey PRIMARY KEY (id);


--
-- Name: composer_feedback_events composer_feedback_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_feedback_events
    ADD CONSTRAINT composer_feedback_events_pkey PRIMARY KEY (id);


--
-- Name: composer_sends composer_sends_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_sends
    ADD CONSTRAINT composer_sends_pkey PRIMARY KEY (id);


--
-- Name: composer_sends composer_sends_workspace_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_sends
    ADD CONSTRAINT composer_sends_workspace_id_idempotency_key_key UNIQUE (workspace_id, idempotency_key);


--
-- Name: composer_snapshots composer_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_snapshots
    ADD CONSTRAINT composer_snapshots_pkey PRIMARY KEY (id);


--
-- Name: composer_snapshots composer_snapshots_workspace_id_campaign_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_snapshots
    ADD CONSTRAINT composer_snapshots_workspace_id_campaign_id_version_number_key UNIQUE (workspace_id, campaign_id, version_number);


--
-- Name: content_ideas content_ideas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_ideas
    ADD CONSTRAINT content_ideas_pkey PRIMARY KEY (id);


--
-- Name: cost_forecasts cost_forecasts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_forecasts
    ADD CONSTRAINT cost_forecasts_pkey PRIMARY KEY (id);


--
-- Name: cost_forecasts cost_forecasts_workspace_id_forecast_date_period_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_forecasts
    ADD CONSTRAINT cost_forecasts_workspace_id_forecast_date_period_type_key UNIQUE (workspace_id, forecast_date, period_type);


--
-- Name: creator_earnings creator_earnings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_earnings
    ADD CONSTRAINT creator_earnings_pkey PRIMARY KEY (id);


--
-- Name: custom_roles custom_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_roles
    ADD CONSTRAINT custom_roles_pkey PRIMARY KEY (id);


--
-- Name: custom_roles custom_roles_workspace_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_roles
    ADD CONSTRAINT custom_roles_workspace_id_name_key UNIQUE (workspace_id, name);


--
-- Name: deck_slides deck_slides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deck_slides
    ADD CONSTRAINT deck_slides_pkey PRIMARY KEY (id);


--
-- Name: deployments deployments_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployments
    ADD CONSTRAINT deployments_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: deployments deployments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployments
    ADD CONSTRAINT deployments_pkey PRIMARY KEY (id);


--
-- Name: design_quality_events design_quality_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_quality_events
    ADD CONSTRAINT design_quality_events_pkey PRIMARY KEY (id);


--
-- Name: design_templates design_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_templates
    ADD CONSTRAINT design_templates_pkey PRIMARY KEY (id);


--
-- Name: design_templates design_templates_section_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_templates
    ADD CONSTRAINT design_templates_section_id_key UNIQUE (section_id);


--
-- Name: escalations escalations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escalations
    ADD CONSTRAINT escalations_pkey PRIMARY KEY (id);


--
-- Name: escalations escalations_workspace_id_campaign_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escalations
    ADD CONSTRAINT escalations_workspace_id_campaign_id_idempotency_key_key UNIQUE (workspace_id, campaign_id, idempotency_key);


--
-- Name: evidence evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence
    ADD CONSTRAINT evidence_pkey PRIMARY KEY (id);


--
-- Name: experiment_assignments experiment_assignments_experiment_id_visitor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experiment_assignments
    ADD CONSTRAINT experiment_assignments_experiment_id_visitor_id_key UNIQUE (experiment_id, visitor_id);


--
-- Name: experiment_assignments experiment_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experiment_assignments
    ADD CONSTRAINT experiment_assignments_pkey PRIMARY KEY (id);


--
-- Name: experiment_events experiment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experiment_events
    ADD CONSTRAINT experiment_events_pkey PRIMARY KEY (id);


--
-- Name: experiment_metrics experiment_metrics_experiment_id_variant_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experiment_metrics
    ADD CONSTRAINT experiment_metrics_experiment_id_variant_id_date_key UNIQUE (experiment_id, variant_id, date);


--
-- Name: experiment_metrics experiment_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experiment_metrics
    ADD CONSTRAINT experiment_metrics_pkey PRIMARY KEY (id);


--
-- Name: experiment_results experiment_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experiment_results
    ADD CONSTRAINT experiment_results_pkey PRIMARY KEY (id);


--
-- Name: experiment_variants experiment_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experiment_variants
    ADD CONSTRAINT experiment_variants_pkey PRIMARY KEY (id);


--
-- Name: experiments experiments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experiments
    ADD CONSTRAINT experiments_pkey PRIMARY KEY (id);


--
-- Name: followup_flows followup_flows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.followup_flows
    ADD CONSTRAINT followup_flows_pkey PRIMARY KEY (id);


--
-- Name: gallery_collection_items gallery_collection_items_collection_id_public_campaign_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_collection_items
    ADD CONSTRAINT gallery_collection_items_collection_id_public_campaign_id_key UNIQUE (collection_id, public_campaign_id);


--
-- Name: gallery_collection_items gallery_collection_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_collection_items
    ADD CONSTRAINT gallery_collection_items_pkey PRIMARY KEY (id);


--
-- Name: gallery_collections gallery_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_collections
    ADD CONSTRAINT gallery_collections_pkey PRIMARY KEY (id);


--
-- Name: gallery_collections gallery_collections_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_collections
    ADD CONSTRAINT gallery_collections_slug_key UNIQUE (slug);


--
-- Name: gallery_interactions gallery_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_interactions
    ADD CONSTRAINT gallery_interactions_pkey PRIMARY KEY (id);


--
-- Name: gallery_interactions gallery_interactions_public_campaign_id_workspace_id_intera_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_interactions
    ADD CONSTRAINT gallery_interactions_public_campaign_id_workspace_id_intera_key UNIQUE (public_campaign_id, workspace_id, interaction_type);


--
-- Name: generated_images generated_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_images
    ADD CONSTRAINT generated_images_pkey PRIMARY KEY (id);


--
-- Name: generations generations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generations
    ADD CONSTRAINT generations_pkey PRIMARY KEY (id);


--
-- Name: hubspot_connections hubspot_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hubspot_connections
    ADD CONSTRAINT hubspot_connections_pkey PRIMARY KEY (id);


--
-- Name: hubspot_connections hubspot_connections_workspace_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hubspot_connections
    ADD CONSTRAINT hubspot_connections_workspace_id_key UNIQUE (workspace_id);


--
-- Name: hubspot_contacts hubspot_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hubspot_contacts
    ADD CONSTRAINT hubspot_contacts_pkey PRIMARY KEY (id);


--
-- Name: hubspot_contacts hubspot_contacts_workspace_id_hubspot_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hubspot_contacts
    ADD CONSTRAINT hubspot_contacts_workspace_id_hubspot_id_key UNIQUE (workspace_id, hubspot_id);


--
-- Name: hubspot_lists hubspot_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hubspot_lists
    ADD CONSTRAINT hubspot_lists_pkey PRIMARY KEY (id);


--
-- Name: hubspot_lists hubspot_lists_workspace_id_hubspot_list_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hubspot_lists
    ADD CONSTRAINT hubspot_lists_workspace_id_hubspot_list_id_key UNIQUE (workspace_id, hubspot_list_id);


--
-- Name: hubspot_sync_jobs hubspot_sync_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hubspot_sync_jobs
    ADD CONSTRAINT hubspot_sync_jobs_pkey PRIMARY KEY (id);


--
-- Name: kit_deployments kit_deployments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kit_deployments
    ADD CONSTRAINT kit_deployments_pkey PRIMARY KEY (id);


--
-- Name: knowledge_collection_items knowledge_collection_items_collection_id_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_collection_items
    ADD CONSTRAINT knowledge_collection_items_collection_id_item_id_key UNIQUE (collection_id, item_id);


--
-- Name: knowledge_collection_items knowledge_collection_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_collection_items
    ADD CONSTRAINT knowledge_collection_items_pkey PRIMARY KEY (id);


--
-- Name: knowledge_collections knowledge_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_collections
    ADD CONSTRAINT knowledge_collections_pkey PRIMARY KEY (id);


--
-- Name: knowledge_items knowledge_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_items
    ADD CONSTRAINT knowledge_items_pkey PRIMARY KEY (id);


--
-- Name: language_usage_stats language_usage_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.language_usage_stats
    ADD CONSTRAINT language_usage_stats_pkey PRIMARY KEY (id);


--
-- Name: language_usage_stats language_usage_stats_workspace_id_language_code_content_typ_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.language_usage_stats
    ADD CONSTRAINT language_usage_stats_workspace_id_language_code_content_typ_key UNIQUE (workspace_id, language_code, content_type);


--
-- Name: launch_kits launch_kits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.launch_kits
    ADD CONSTRAINT launch_kits_pkey PRIMARY KEY (id);


--
-- Name: learned_sections learned_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learned_sections
    ADD CONSTRAINT learned_sections_pkey PRIMARY KEY (id);


--
-- Name: legal_rules legal_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legal_rules
    ADD CONSTRAINT legal_rules_pkey PRIMARY KEY (id);


--
-- Name: marketplace_templates marketplace_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_templates
    ADD CONSTRAINT marketplace_templates_pkey PRIMARY KEY (id);


--
-- Name: memory_items memory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_items
    ADD CONSTRAINT memory_items_pkey PRIMARY KEY (id);


--
-- Name: message_evidence message_evidence_message_id_evidence_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_evidence
    ADD CONSTRAINT message_evidence_message_id_evidence_id_key UNIQUE (message_id, evidence_id);


--
-- Name: message_evidence message_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_evidence
    ADD CONSTRAINT message_evidence_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: newsletter_ab_tests newsletter_ab_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_ab_tests
    ADD CONSTRAINT newsletter_ab_tests_pkey PRIMARY KEY (id);


--
-- Name: newsletter_templates newsletter_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_templates
    ADD CONSTRAINT newsletter_templates_pkey PRIMARY KEY (id);


--
-- Name: newsletters newsletters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletters
    ADD CONSTRAINT newsletters_pkey PRIMARY KEY (id);


--
-- Name: page_blocks page_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_blocks
    ADD CONSTRAINT page_blocks_pkey PRIMARY KEY (id);


--
-- Name: page_transitions page_transitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_transitions
    ADD CONSTRAINT page_transitions_pkey PRIMARY KEY (id);


--
-- Name: page_view_events page_view_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_view_events
    ADD CONSTRAINT page_view_events_pkey PRIMARY KEY (id);


--
-- Name: performance performance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance
    ADD CONSTRAINT performance_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: policies policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policies
    ADD CONSTRAINT policies_pkey PRIMARY KEY (id);


--
-- Name: policies policies_workspace_id_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policies
    ADD CONSTRAINT policies_workspace_id_version_key UNIQUE (workspace_id, version);


--
-- Name: positioning_suggestions positioning_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.positioning_suggestions
    ADD CONSTRAINT positioning_suggestions_pkey PRIMARY KEY (id);


--
-- Name: private_chat_messages private_chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_chat_messages
    ADD CONSTRAINT private_chat_messages_pkey PRIMARY KEY (id);


--
-- Name: private_chats private_chats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_chats
    ADD CONSTRAINT private_chats_pkey PRIMARY KEY (id);


--
-- Name: product_facts product_facts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_facts
    ADD CONSTRAINT product_facts_pkey PRIMARY KEY (id);


--
-- Name: project_assets project_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assets
    ADD CONSTRAINT project_assets_pkey PRIMARY KEY (id);


--
-- Name: project_members project_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_pkey PRIMARY KEY (id);


--
-- Name: project_members project_members_project_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_user_id_key UNIQUE (project_id, user_id);


--
-- Name: project_pages project_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_pages
    ADD CONSTRAINT project_pages_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: provider_connections provider_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_connections
    ADD CONSTRAINT provider_connections_pkey PRIMARY KEY (id);


--
-- Name: provider_connections provider_connections_workspace_id_provider_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_connections
    ADD CONSTRAINT provider_connections_workspace_id_provider_id_key UNIQUE (workspace_id, provider_id);


--
-- Name: provider_health_checks provider_health_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_health_checks
    ADD CONSTRAINT provider_health_checks_pkey PRIMARY KEY (id);


--
-- Name: provider_health_summary provider_health_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_health_summary
    ADD CONSTRAINT provider_health_summary_pkey PRIMARY KEY (id);


--
-- Name: provider_health_summary provider_health_summary_workspace_id_provider_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_health_summary
    ADD CONSTRAINT provider_health_summary_workspace_id_provider_type_key UNIQUE (workspace_id, provider_type);


--
-- Name: provider_incidents provider_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_incidents
    ADD CONSTRAINT provider_incidents_pkey PRIMARY KEY (id);


--
-- Name: public_campaigns public_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_campaigns
    ADD CONSTRAINT public_campaigns_pkey PRIMARY KEY (id);


--
-- Name: published_pages published_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.published_pages
    ADD CONSTRAINT published_pages_pkey PRIMARY KEY (id);


--
-- Name: published_pages published_pages_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.published_pages
    ADD CONSTRAINT published_pages_slug_key UNIQUE (slug);


--
-- Name: published_sites published_sites_custom_domain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.published_sites
    ADD CONSTRAINT published_sites_custom_domain_key UNIQUE (custom_domain);


--
-- Name: published_sites published_sites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.published_sites
    ADD CONSTRAINT published_sites_pkey PRIMARY KEY (id);


--
-- Name: published_sites published_sites_subdomain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.published_sites
    ADD CONSTRAINT published_sites_subdomain_key UNIQUE (subdomain);


--
-- Name: requests requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_pkey PRIMARY KEY (id);


--
-- Name: sako_task_activity sako_task_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sako_task_activity
    ADD CONSTRAINT sako_task_activity_pkey PRIMARY KEY (id);


--
-- Name: sako_tasks sako_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sako_tasks
    ADD CONSTRAINT sako_tasks_pkey PRIMARY KEY (id);


--
-- Name: saved_ad_creatives saved_ad_creatives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_ad_creatives
    ADD CONSTRAINT saved_ad_creatives_pkey PRIMARY KEY (id);


--
-- Name: saved_newsletters saved_newsletters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_newsletters
    ADD CONSTRAINT saved_newsletters_pkey PRIMARY KEY (id);


--
-- Name: scheduled_content scheduled_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_content
    ADD CONSTRAINT scheduled_content_pkey PRIMARY KEY (id);


--
-- Name: section_analytics section_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_analytics
    ADD CONSTRAINT section_analytics_pkey PRIMARY KEY (id);


--
-- Name: section_analytics section_analytics_template_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_analytics
    ADD CONSTRAINT section_analytics_template_id_date_key UNIQUE (template_id, date);


--
-- Name: share_comments share_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_comments
    ADD CONSTRAINT share_comments_pkey PRIMARY KEY (id);


--
-- Name: share_links share_links_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_links
    ADD CONSTRAINT share_links_code_key UNIQUE (code);


--
-- Name: share_links share_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_links
    ADD CONSTRAINT share_links_pkey PRIMARY KEY (id);


--
-- Name: share_tokens share_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_tokens
    ADD CONSTRAINT share_tokens_pkey PRIMARY KEY (id);


--
-- Name: share_tokens share_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_tokens
    ADD CONSTRAINT share_tokens_token_key UNIQUE (token);


--
-- Name: share_views share_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_views
    ADD CONSTRAINT share_views_pkey PRIMARY KEY (id);


--
-- Name: slack_users slack_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_users
    ADD CONSTRAINT slack_users_pkey PRIMARY KEY (id);


--
-- Name: slack_users slack_users_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_users
    ADD CONSTRAINT slack_users_unique UNIQUE (slack_user_id, slack_team_id);


--
-- Name: snippet_favorites snippet_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snippet_favorites
    ADD CONSTRAINT snippet_favorites_pkey PRIMARY KEY (id);


--
-- Name: snippet_favorites snippet_favorites_snippet_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snippet_favorites
    ADD CONSTRAINT snippet_favorites_snippet_id_user_id_key UNIQUE (snippet_id, user_id);


--
-- Name: snippets snippets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snippets
    ADD CONSTRAINT snippets_pkey PRIMARY KEY (id);


--
-- Name: social_calendars social_calendars_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_calendars
    ADD CONSTRAINT social_calendars_pkey PRIMARY KEY (id);


--
-- Name: social_post_variants social_post_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_post_variants
    ADD CONSTRAINT social_post_variants_pkey PRIMARY KEY (id);


--
-- Name: social_posts social_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_pkey PRIMARY KEY (id);


--
-- Name: sso_configurations sso_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sso_configurations
    ADD CONSTRAINT sso_configurations_pkey PRIMARY KEY (id);


--
-- Name: sso_configurations sso_configurations_workspace_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sso_configurations
    ADD CONSTRAINT sso_configurations_workspace_id_key UNIQUE (workspace_id);


--
-- Name: studio_app_favorites studio_app_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_app_favorites
    ADD CONSTRAINT studio_app_favorites_pkey PRIMARY KEY (id);


--
-- Name: studio_app_favorites studio_app_favorites_user_id_app_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_app_favorites
    ADD CONSTRAINT studio_app_favorites_user_id_app_id_key UNIQUE (user_id, app_id);


--
-- Name: studio_app_runs studio_app_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_app_runs
    ADD CONSTRAINT studio_app_runs_pkey PRIMARY KEY (id);


--
-- Name: studio_apps studio_apps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_apps
    ADD CONSTRAINT studio_apps_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_workspace_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_workspace_id_key UNIQUE (workspace_id);


--
-- Name: supported_languages supported_languages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supported_languages
    ADD CONSTRAINT supported_languages_pkey PRIMARY KEY (code);


--
-- Name: task_composer_snapshots task_composer_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_composer_snapshots
    ADD CONSTRAINT task_composer_snapshots_pkey PRIMARY KEY (id);


--
-- Name: task_composer_snapshots task_composer_snapshots_task_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_composer_snapshots
    ADD CONSTRAINT task_composer_snapshots_task_id_key UNIQUE (task_id);


--
-- Name: team_sessions team_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_sessions
    ADD CONSTRAINT team_sessions_pkey PRIMARY KEY (id);


--
-- Name: template_acquisitions template_acquisitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_acquisitions
    ADD CONSTRAINT template_acquisitions_pkey PRIMARY KEY (id);


--
-- Name: template_acquisitions template_acquisitions_workspace_id_template_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_acquisitions
    ADD CONSTRAINT template_acquisitions_workspace_id_template_id_key UNIQUE (workspace_id, template_id);


--
-- Name: template_purchases template_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_purchases
    ADD CONSTRAINT template_purchases_pkey PRIMARY KEY (id);


--
-- Name: template_purchases template_purchases_template_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_purchases
    ADD CONSTRAINT template_purchases_template_id_user_id_key UNIQUE (template_id, user_id);


--
-- Name: template_reviews template_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_reviews
    ADD CONSTRAINT template_reviews_pkey PRIMARY KEY (id);


--
-- Name: template_reviews template_reviews_template_id_workspace_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_reviews
    ADD CONSTRAINT template_reviews_template_id_workspace_id_key UNIQUE (template_id, workspace_id);


--
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- Name: ui_components ui_components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_components
    ADD CONSTRAINT ui_components_pkey PRIMARY KEY (id);


--
-- Name: usage_aggregates usage_aggregates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_aggregates
    ADD CONSTRAINT usage_aggregates_pkey PRIMARY KEY (id);


--
-- Name: usage_aggregates usage_aggregates_workspace_id_period_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_aggregates
    ADD CONSTRAINT usage_aggregates_workspace_id_period_start_key UNIQUE (workspace_id, period_start);


--
-- Name: usage_events usage_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_events
    ADD CONSTRAINT usage_events_pkey PRIMARY KEY (id);


--
-- Name: usage_metrics usage_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_metrics
    ADD CONSTRAINT usage_metrics_pkey PRIMARY KEY (id);


--
-- Name: user_saved_components user_saved_components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_saved_components
    ADD CONSTRAINT user_saved_components_pkey PRIMARY KEY (id);


--
-- Name: user_saved_components user_saved_components_user_id_component_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_saved_components
    ADD CONSTRAINT user_saved_components_user_id_component_id_key UNIQUE (user_id, component_id);


--
-- Name: user_snippets user_snippets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_snippets
    ADD CONSTRAINT user_snippets_pkey PRIMARY KEY (id);


--
-- Name: user_snippets user_snippets_user_id_snippet_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_snippets
    ADD CONSTRAINT user_snippets_user_id_snippet_id_key UNIQUE (user_id, snippet_id);


--
-- Name: video_scenes video_scenes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_scenes
    ADD CONSTRAINT video_scenes_pkey PRIMARY KEY (id);


--
-- Name: video_scripts video_scripts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_scripts
    ADD CONSTRAINT video_scripts_pkey PRIMARY KEY (id);


--
-- Name: voiceovers voiceovers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voiceovers
    ADD CONSTRAINT voiceovers_pkey PRIMARY KEY (id);


--
-- Name: wallet_transactions wallet_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);


--
-- Name: webhook_configurations webhook_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_configurations
    ADD CONSTRAINT webhook_configurations_pkey PRIMARY KEY (id);


--
-- Name: webhook_deliveries webhook_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_pkey PRIMARY KEY (id);


--
-- Name: website_designs website_designs_custom_domain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_designs
    ADD CONSTRAINT website_designs_custom_domain_key UNIQUE (custom_domain);


--
-- Name: website_designs website_designs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_designs
    ADD CONSTRAINT website_designs_pkey PRIMARY KEY (id);


--
-- Name: website_designs website_designs_subdomain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_designs
    ADD CONSTRAINT website_designs_subdomain_key UNIQUE (subdomain);


--
-- Name: website_pages website_pages_design_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_pages
    ADD CONSTRAINT website_pages_design_id_slug_key UNIQUE (design_id, slug);


--
-- Name: website_pages website_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_pages
    ADD CONSTRAINT website_pages_pkey PRIMARY KEY (id);


--
-- Name: workflow_node_executions workflow_node_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_node_executions
    ADD CONSTRAINT workflow_node_executions_pkey PRIMARY KEY (id);


--
-- Name: workflow_runs workflow_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_pkey PRIMARY KEY (id);


--
-- Name: workflow_templates workflow_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_templates
    ADD CONSTRAINT workflow_templates_pkey PRIMARY KEY (id);


--
-- Name: workflows workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);


--
-- Name: workspace_members workspace_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_pkey PRIMARY KEY (id);


--
-- Name: workspace_members workspace_members_user_id_workspace_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_user_id_workspace_id_key UNIQUE (user_id, workspace_id);


--
-- Name: workspace_settings workspace_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_settings
    ADD CONSTRAINT workspace_settings_pkey PRIMARY KEY (id);


--
-- Name: workspace_settings workspace_settings_workspace_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_settings
    ADD CONSTRAINT workspace_settings_workspace_id_key UNIQUE (workspace_id);


--
-- Name: workspace_wallets workspace_wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_wallets
    ADD CONSTRAINT workspace_wallets_pkey PRIMARY KEY (id);


--
-- Name: workspace_wallets workspace_wallets_workspace_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_wallets
    ADD CONSTRAINT workspace_wallets_workspace_id_key UNIQUE (workspace_id);


--
-- Name: workspaces workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);


--
-- Name: workspaces workspaces_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_slug_key UNIQUE (slug);


--
-- Name: zapier_api_keys zapier_api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zapier_api_keys
    ADD CONSTRAINT zapier_api_keys_pkey PRIMARY KEY (id);


--
-- Name: zapier_webhook_deliveries zapier_webhook_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zapier_webhook_deliveries
    ADD CONSTRAINT zapier_webhook_deliveries_pkey PRIMARY KEY (id);


--
-- Name: zapier_webhook_subscriptions zapier_webhook_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zapier_webhook_subscriptions
    ADD CONSTRAINT zapier_webhook_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: ad_creatives_campaign_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ad_creatives_campaign_idx ON public.ad_creatives USING btree (campaign_id);


--
-- Name: ad_creatives_platform_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ad_creatives_platform_idx ON public.ad_creatives USING btree (platform, format);


--
-- Name: ad_creatives_workspace_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ad_creatives_workspace_idx ON public.ad_creatives USING btree (workspace_id);


--
-- Name: ai_traces_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_traces_created_at_idx ON public.ai_traces USING btree (created_at);


--
-- Name: ai_traces_model_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_traces_model_idx ON public.ai_traces USING btree (model);


--
-- Name: ai_traces_operation_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_traces_operation_type_idx ON public.ai_traces USING btree (operation_type);


--
-- Name: ai_traces_workspace_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_traces_workspace_id_idx ON public.ai_traces USING btree (workspace_id);


--
-- Name: compliance_reports_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compliance_reports_created_at ON public.compliance_reports USING btree (created_at DESC);


--
-- Name: compliance_reports_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compliance_reports_token ON public.compliance_reports USING btree (token);


--
-- Name: content_ideas_archetype_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_ideas_archetype_idx ON public.content_ideas USING btree (archetype_id);


--
-- Name: content_ideas_workspace_archetype_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_ideas_workspace_archetype_idx ON public.content_ideas USING btree (workspace_id, archetype_id) WHERE (status = 'new'::text);


--
-- Name: idx_ad_ab_tests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_ab_tests_status ON public.ad_ab_tests USING btree (status);


--
-- Name: idx_ad_ab_tests_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_ab_tests_workspace ON public.ad_ab_tests USING btree (workspace_id);


--
-- Name: idx_ad_creative_versions_creative; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_creative_versions_creative ON public.ad_creative_versions USING btree (creative_id);


--
-- Name: idx_ad_creative_versions_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_ad_creative_versions_unique ON public.ad_creative_versions USING btree (creative_id, version_number);


--
-- Name: idx_ad_format_configs_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_format_configs_platform ON public.ad_format_configs USING btree (platform);


--
-- Name: idx_ad_format_configs_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_ad_format_configs_unique ON public.ad_format_configs USING btree (workspace_id, platform, format);


--
-- Name: idx_ad_format_configs_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_format_configs_workspace ON public.ad_format_configs USING btree (workspace_id);


--
-- Name: idx_affiliates_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_affiliates_code ON public.affiliates USING btree (code);


--
-- Name: idx_affiliates_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_affiliates_status ON public.affiliates USING btree (status);


--
-- Name: idx_affiliates_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_affiliates_user ON public.affiliates USING btree (user_id);


--
-- Name: idx_agent_runs_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_runs_workspace ON public.agent_runs USING btree (workspace_id, started_at DESC);


--
-- Name: idx_angles_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_angles_campaign ON public.angles USING btree (campaign_id);


--
-- Name: idx_api_keys_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_hash ON public.api_keys USING btree (key_hash) WHERE (is_active = true);


--
-- Name: idx_api_keys_prefix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_prefix ON public.api_keys USING btree (key_prefix);


--
-- Name: idx_api_keys_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_workspace ON public.api_keys USING btree (workspace_id);


--
-- Name: idx_api_usage_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_usage_key ON public.api_usage USING btree (api_key_id, created_at DESC);


--
-- Name: idx_api_usage_workspace_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_usage_workspace_time ON public.api_usage USING btree (workspace_id, created_at DESC);


--
-- Name: idx_approval_decisions_instance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_decisions_instance ON public.approval_decisions USING btree (instance_id);


--
-- Name: idx_approval_instances_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_instances_campaign ON public.approval_instances USING btree (campaign_id);


--
-- Name: idx_approval_instances_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_instances_pending ON public.approval_instances USING btree (workspace_id, status) WHERE (status = ANY (ARRAY['pending'::text, 'in_progress'::text]));


--
-- Name: idx_approval_instances_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_instances_status ON public.approval_instances USING btree (status);


--
-- Name: idx_approval_instances_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_instances_workspace ON public.approval_instances USING btree (workspace_id);


--
-- Name: idx_approval_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_requests_status ON public.approval_requests USING btree (status, expires_at);


--
-- Name: idx_approval_requests_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_requests_workspace ON public.approval_requests USING btree (workspace_id, status);


--
-- Name: idx_approval_templates_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_templates_active ON public.approval_templates USING btree (workspace_id) WHERE (is_active = true);


--
-- Name: idx_approval_templates_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_templates_workspace ON public.approval_templates USING btree (workspace_id);


--
-- Name: idx_approval_templates_workspace_default; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_approval_templates_workspace_default ON public.approval_templates USING btree (workspace_id) WHERE (is_default = true);


--
-- Name: idx_approvals_claim; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approvals_claim ON public.approvals USING btree (claim_id);


--
-- Name: idx_approvals_decision; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approvals_decision ON public.approvals USING btree (decision);


--
-- Name: idx_approvals_reviewer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approvals_reviewer ON public.approvals USING btree (reviewer_id);


--
-- Name: idx_assembled_videos_script; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assembled_videos_script ON public.assembled_videos USING btree (script_id);


--
-- Name: idx_assembled_videos_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assembled_videos_status ON public.assembled_videos USING btree (status);


--
-- Name: idx_asset_comments_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_comments_asset ON public.asset_comments USING btree (asset_id);


--
-- Name: idx_asset_comments_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_comments_parent ON public.asset_comments USING btree (parent_id);


--
-- Name: idx_asset_comments_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_comments_project ON public.asset_comments USING btree (project_id);


--
-- Name: idx_asset_comments_resolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_comments_resolved ON public.asset_comments USING btree (resolved) WHERE (resolved = false);


--
-- Name: idx_asset_comments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_comments_user ON public.asset_comments USING btree (user_id);


--
-- Name: idx_asset_comments_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_comments_workspace ON public.asset_comments USING btree (workspace_id);


--
-- Name: idx_asset_documents_brain_snapshot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_documents_brain_snapshot ON public.asset_documents USING btree (brain_snapshot_id);


--
-- Name: idx_asset_documents_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_documents_brand ON public.asset_documents USING btree (brand_id);


--
-- Name: idx_asset_documents_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_documents_campaign ON public.asset_documents USING btree (campaign_id);


--
-- Name: idx_asset_documents_compliance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_documents_compliance ON public.asset_documents USING btree (compliance_status) WHERE (compliance_status <> 'clean'::text);


--
-- Name: idx_asset_documents_generation_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_asset_documents_generation_key ON public.asset_documents USING btree (workspace_id, campaign_id, asset_type, generation_key) WHERE (generation_key IS NOT NULL);


--
-- Name: idx_asset_documents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_documents_status ON public.asset_documents USING btree (workspace_id, status);


--
-- Name: idx_asset_documents_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_documents_type ON public.asset_documents USING btree (workspace_id, asset_type);


--
-- Name: idx_asset_documents_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_documents_workspace ON public.asset_documents USING btree (workspace_id);


--
-- Name: idx_asset_renders_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_renders_document ON public.asset_renders USING btree (asset_document_id);


--
-- Name: idx_asset_renders_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_asset_renders_unique ON public.asset_renders USING btree (asset_document_id, format, width, height) WHERE (status = 'completed'::text);


--
-- Name: idx_assignments_experiment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_experiment ON public.experiment_assignments USING btree (experiment_id);


--
-- Name: idx_assignments_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_variant ON public.experiment_assignments USING btree (variant_id);


--
-- Name: idx_assignments_visitor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_visitor ON public.experiment_assignments USING btree (visitor_id);


--
-- Name: idx_audiences_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audiences_active ON public.audiences USING btree (workspace_id) WHERE (is_active = true);


--
-- Name: idx_audiences_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audiences_workspace ON public.audiences USING btree (workspace_id);


--
-- Name: idx_audiences_workspace_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_audiences_workspace_primary ON public.audiences USING btree (workspace_id) WHERE (is_primary = true);


--
-- Name: idx_audit_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_actor ON public.audit_log USING btree (actor_id);


--
-- Name: idx_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_created ON public.audit_log USING btree (created_at DESC);


--
-- Name: idx_audit_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_entity ON public.audit_log USING btree (entity_type, entity_id);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_resource ON public.audit_logs USING btree (resource_type, resource_id);


--
-- Name: idx_audit_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_id);


--
-- Name: idx_audit_logs_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_workspace ON public.audit_logs USING btree (workspace_id);


--
-- Name: idx_audit_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_workspace ON public.audit_log USING btree (workspace_id);


--
-- Name: idx_automation_rules_next_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_rules_next_run ON public.automation_rules USING btree (next_run_at) WHERE (status = 'active'::text);


--
-- Name: idx_automation_rules_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_rules_status ON public.automation_rules USING btree (status) WHERE (status = 'active'::text);


--
-- Name: idx_automation_rules_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_rules_workspace ON public.automation_rules USING btree (workspace_id);


--
-- Name: idx_automation_runs_idempotent; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_automation_runs_idempotent ON public.automation_runs USING btree (workspace_id, automation_rule_id, run_key);


--
-- Name: idx_automation_runs_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_runs_rule ON public.automation_runs USING btree (automation_rule_id, created_at DESC);


--
-- Name: idx_automation_runs_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_runs_workspace ON public.automation_runs USING btree (workspace_id);


--
-- Name: idx_battle_cards_competitor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_battle_cards_competitor ON public.battle_cards USING btree (competitor_id);


--
-- Name: idx_battle_cards_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_battle_cards_workspace ON public.battle_cards USING btree (workspace_id);


--
-- Name: idx_bigquery_sync_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bigquery_sync_active ON public.bigquery_sync_configs USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_bigquery_sync_history_config; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bigquery_sync_history_config ON public.bigquery_sync_history USING btree (sync_config_id);


--
-- Name: idx_bigquery_sync_history_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bigquery_sync_history_status ON public.bigquery_sync_history USING btree (status);


--
-- Name: idx_bigquery_sync_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bigquery_sync_type ON public.bigquery_sync_configs USING btree (sync_type);


--
-- Name: idx_bigquery_sync_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bigquery_sync_workspace ON public.bigquery_sync_configs USING btree (workspace_id);


--
-- Name: idx_brain_learning_runs_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brain_learning_runs_workspace ON public.brain_learning_runs USING btree (workspace_id, created_at DESC);


--
-- Name: idx_brain_snapshots_brand_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brain_snapshots_brand_status ON public.brain_snapshots USING btree (brand_id, status, created_at DESC);


--
-- Name: idx_brain_snapshots_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brain_snapshots_workspace ON public.brain_snapshots USING btree (workspace_id, created_at DESC);


--
-- Name: idx_brain_sources_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brain_sources_brand ON public.brain_sources USING btree (brand_id);


--
-- Name: idx_brain_sources_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brain_sources_type ON public.brain_sources USING btree (workspace_id, source_type);


--
-- Name: idx_brain_sources_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brain_sources_workspace ON public.brain_sources USING btree (workspace_id);


--
-- Name: idx_brain_sync_runs_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brain_sync_runs_source ON public.brain_sync_runs USING btree (brain_source_id, started_at DESC);


--
-- Name: idx_brain_sync_runs_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brain_sync_runs_workspace ON public.brain_sync_runs USING btree (workspace_id, started_at DESC);


--
-- Name: idx_brand_assets_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brand_assets_brand ON public.brand_assets USING btree (brand_id);


--
-- Name: idx_brand_memory_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brand_memory_brand ON public.brand_memory USING btree (brand_id);


--
-- Name: idx_brand_memory_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_brand_memory_unique ON public.brand_memory USING btree (brand_id, workspace_id);


--
-- Name: idx_brand_memory_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brand_memory_workspace ON public.brand_memory USING btree (workspace_id);


--
-- Name: idx_brands_default_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_brands_default_workspace ON public.brands USING btree (workspace_id) WHERE (is_default = true);


--
-- Name: idx_brands_visual_style; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brands_visual_style ON public.brands USING btree (visual_style) WHERE (visual_style IS NOT NULL);


--
-- Name: idx_brands_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brands_workspace ON public.brands USING btree (workspace_id);


--
-- Name: idx_budget_alert_history_alert; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_alert_history_alert ON public.budget_alert_history USING btree (alert_id);


--
-- Name: idx_budget_alert_history_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_alert_history_time ON public.budget_alert_history USING btree (workspace_id, triggered_at DESC);


--
-- Name: idx_budget_alert_history_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_alert_history_workspace ON public.budget_alert_history USING btree (workspace_id);


--
-- Name: idx_budget_alerts_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_alerts_active ON public.budget_alerts USING btree (workspace_id) WHERE (is_active = true);


--
-- Name: idx_budget_alerts_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_alerts_workspace ON public.budget_alerts USING btree (workspace_id);


--
-- Name: idx_campaign_assets_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_assets_campaign ON public.campaign_assets USING btree (campaign_id);


--
-- Name: idx_campaign_assets_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_assets_created ON public.campaign_assets USING btree (created_at DESC);


--
-- Name: idx_campaign_assets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_assets_status ON public.campaign_assets USING btree (status);


--
-- Name: idx_campaign_assets_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_assets_type ON public.campaign_assets USING btree (asset_type);


--
-- Name: idx_campaign_assets_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_assets_workspace ON public.campaign_assets USING btree (workspace_id);


--
-- Name: idx_campaign_claim_links_asset_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_claim_links_asset_document ON public.campaign_claim_links USING btree (asset_document_id);


--
-- Name: idx_campaign_claim_links_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_claim_links_campaign ON public.campaign_claim_links USING btree (campaign_id);


--
-- Name: idx_campaign_claim_links_claim; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_claim_links_claim ON public.campaign_claim_links USING btree (claim_id);


--
-- Name: idx_campaign_claim_links_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_claim_links_message ON public.campaign_claim_links USING btree (message_id);


--
-- Name: idx_campaign_claim_links_unique_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_campaign_claim_links_unique_asset ON public.campaign_claim_links USING btree (claim_id, asset_document_id) WHERE (asset_document_id IS NOT NULL);


--
-- Name: idx_campaign_claim_links_unique_campaign_source; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_campaign_claim_links_unique_campaign_source ON public.campaign_claim_links USING btree (claim_id, campaign_id, source) WHERE ((asset_document_id IS NULL) AND (message_id IS NULL));


--
-- Name: idx_campaign_claim_links_unique_message; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_campaign_claim_links_unique_message ON public.campaign_claim_links USING btree (claim_id, message_id) WHERE (message_id IS NOT NULL);


--
-- Name: idx_campaign_claim_links_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_claim_links_workspace ON public.campaign_claim_links USING btree (workspace_id);


--
-- Name: idx_campaign_fact_citations_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_fact_citations_campaign ON public.campaign_fact_citations USING btree (campaign_id);


--
-- Name: idx_campaign_fact_citations_fact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_fact_citations_fact ON public.campaign_fact_citations USING btree (fact_id);


--
-- Name: idx_campaign_fact_citations_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_fact_citations_workspace ON public.campaign_fact_citations USING btree (workspace_id, created_at DESC);


--
-- Name: idx_campaign_targeting_rules_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_targeting_rules_campaign ON public.campaign_targeting_rules USING btree (campaign_id);


--
-- Name: idx_campaign_versions_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_versions_campaign ON public.campaign_versions USING btree (campaign_id);


--
-- Name: idx_campaign_versions_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_versions_created ON public.campaign_versions USING btree (campaign_id, created_at DESC);


--
-- Name: idx_campaigns_audience; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_audience ON public.campaigns USING btree (audience_id) WHERE (audience_id IS NOT NULL);


--
-- Name: idx_campaigns_brain_snapshot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_brain_snapshot ON public.campaigns USING btree (brain_snapshot_id);


--
-- Name: idx_campaigns_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_brand ON public.campaigns USING btree (brand_id) WHERE (brand_id IS NOT NULL);


--
-- Name: idx_campaigns_landing_design_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_landing_design_id ON public.campaigns USING btree (landing_design_id);


--
-- Name: idx_campaigns_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_status ON public.campaigns USING btree (status);


--
-- Name: idx_campaigns_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_workspace ON public.campaigns USING btree (workspace_id);


--
-- Name: idx_cancellation_feedback_reason; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cancellation_feedback_reason ON public.cancellation_feedback USING btree (reason);


--
-- Name: idx_cancellation_feedback_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cancellation_feedback_workspace ON public.cancellation_feedback USING btree (workspace_id);


--
-- Name: idx_canvas_comments_canvas; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canvas_comments_canvas ON public.canvas_comments USING btree (canvas_id);


--
-- Name: idx_canvas_comments_element; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canvas_comments_element ON public.canvas_comments USING btree (element_id) WHERE (element_id IS NOT NULL);


--
-- Name: idx_canvas_comments_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canvas_comments_thread ON public.canvas_comments USING btree (thread_id) WHERE (thread_id IS NOT NULL);


--
-- Name: idx_canvas_comments_unresolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canvas_comments_unresolved ON public.canvas_comments USING btree (canvas_id) WHERE (is_resolved = false);


--
-- Name: idx_canvas_elements_canvas; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canvas_elements_canvas ON public.canvas_elements USING btree (canvas_id);


--
-- Name: idx_canvas_elements_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canvas_elements_group ON public.canvas_elements USING btree (group_id) WHERE (group_id IS NOT NULL);


--
-- Name: idx_canvas_elements_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canvas_elements_type ON public.canvas_elements USING btree (canvas_id, type);


--
-- Name: idx_canvas_presence_canvas; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canvas_presence_canvas ON public.canvas_presence USING btree (canvas_id) WHERE (is_active = true);


--
-- Name: idx_canvas_versions_canvas; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canvas_versions_canvas ON public.canvas_versions USING btree (canvas_id);


--
-- Name: idx_canvases_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canvases_active ON public.canvases USING btree (workspace_id) WHERE (status = 'active'::text);


--
-- Name: idx_canvases_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canvases_campaign ON public.canvases USING btree (campaign_id) WHERE (campaign_id IS NOT NULL);


--
-- Name: idx_canvases_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canvases_workspace ON public.canvases USING btree (workspace_id);


--
-- Name: idx_chat_messages_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_created ON public.chat_messages USING btree (created_at);


--
-- Name: idx_chat_messages_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_session ON public.chat_messages USING btree (session_id);


--
-- Name: idx_chat_sessions_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_sessions_updated ON public.chat_sessions USING btree (updated_at DESC);


--
-- Name: idx_chat_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_sessions_user ON public.chat_sessions USING btree (user_id);


--
-- Name: idx_chat_sessions_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_sessions_workspace ON public.chat_sessions USING btree (workspace_id);


--
-- Name: idx_claim_evidence_claim; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claim_evidence_claim ON public.claim_evidence_links USING btree (claim_id);


--
-- Name: idx_claim_evidence_evidence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claim_evidence_evidence ON public.claim_evidence_links USING btree (evidence_id);


--
-- Name: idx_claim_packs_share_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claim_packs_share_token ON public.claim_packs USING btree (share_token) WHERE (share_token IS NOT NULL);


--
-- Name: idx_claim_packs_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claim_packs_workspace ON public.claim_packs USING btree (workspace_id);


--
-- Name: idx_claim_perf_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claim_perf_campaign ON public.claim_performance USING btree (campaign_id) WHERE (campaign_id IS NOT NULL);


--
-- Name: idx_claim_perf_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claim_perf_category ON public.claim_performance USING btree (workspace_id, category);


--
-- Name: idx_claim_perf_claim; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claim_perf_claim ON public.claim_performance USING btree (claim_id);


--
-- Name: idx_claim_perf_conversions; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claim_perf_conversions ON public.claim_performance USING btree (workspace_id, conversion_rate DESC) WHERE (impressions >= 100);


--
-- Name: idx_claim_perf_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claim_perf_score ON public.claim_performance USING btree (workspace_id, performance_score DESC);


--
-- Name: idx_claim_perf_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claim_perf_workspace ON public.claim_performance USING btree (workspace_id);


--
-- Name: idx_claims_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claims_category ON public.claims USING btree (category);


--
-- Name: idx_claims_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claims_created_by ON public.claims USING btree (created_by);


--
-- Name: idx_claims_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claims_status ON public.claims USING btree (status);


--
-- Name: idx_claims_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claims_type ON public.claims USING btree (claim_type);


--
-- Name: idx_claims_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claims_workspace ON public.claims USING btree (workspace_id);


--
-- Name: idx_comment_notifications_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comment_notifications_unread ON public.comment_notifications USING btree (user_id, read) WHERE (read = false);


--
-- Name: idx_comment_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comment_notifications_user ON public.comment_notifications USING btree (user_id);


--
-- Name: idx_comment_reactions_comment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comment_reactions_comment ON public.comment_reactions USING btree (comment_id);


--
-- Name: idx_commissions_affiliate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commissions_affiliate ON public.affiliate_commissions USING btree (affiliate_id);


--
-- Name: idx_commissions_payout; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commissions_payout ON public.affiliate_commissions USING btree (payout_id);


--
-- Name: idx_commissions_referral; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commissions_referral ON public.affiliate_commissions USING btree (referral_id);


--
-- Name: idx_competitors_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_competitors_domain ON public.competitors USING btree (domain);


--
-- Name: idx_competitors_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_competitors_status ON public.competitors USING btree (status);


--
-- Name: idx_competitors_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_competitors_workspace ON public.competitors USING btree (workspace_id);


--
-- Name: idx_components_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_category ON public.ui_components USING btree (category);


--
-- Name: idx_components_public; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_public ON public.ui_components USING btree (is_public);


--
-- Name: idx_components_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_system ON public.ui_components USING btree (is_system);


--
-- Name: idx_components_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_tags ON public.ui_components USING gin (tags);


--
-- Name: idx_components_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_workspace ON public.ui_components USING btree (workspace_id);


--
-- Name: idx_composer_document_versions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_composer_document_versions_created_at ON public.composer_document_versions USING btree (created_at DESC);


--
-- Name: idx_composer_document_versions_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_composer_document_versions_document ON public.composer_document_versions USING btree (document_id);


--
-- Name: idx_composer_document_versions_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_composer_document_versions_workspace ON public.composer_document_versions USING btree (workspace_id);


--
-- Name: idx_composer_documents_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_composer_documents_created_at ON public.composer_documents USING btree (created_at DESC);


--
-- Name: idx_composer_documents_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_composer_documents_workspace ON public.composer_documents USING btree (workspace_id);


--
-- Name: idx_composer_documents_workspace_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_composer_documents_workspace_campaign ON public.composer_documents USING btree (workspace_id, campaign_id) WHERE (campaign_id IS NOT NULL);


--
-- Name: idx_composer_feedback_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_composer_feedback_campaign ON public.composer_feedback_events USING btree (campaign_id);


--
-- Name: idx_composer_feedback_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_composer_feedback_created_at ON public.composer_feedback_events USING btree (created_at);


--
-- Name: idx_composer_feedback_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_composer_feedback_event_type ON public.composer_feedback_events USING btree (event_type);


--
-- Name: idx_composer_feedback_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_composer_feedback_task ON public.composer_feedback_events USING btree (sako_task_id);


--
-- Name: idx_composer_feedback_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_composer_feedback_workspace ON public.composer_feedback_events USING btree (workspace_id);


--
-- Name: idx_composer_sends_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_composer_sends_created_at ON public.composer_sends USING btree (created_at DESC);


--
-- Name: idx_composer_sends_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_composer_sends_document ON public.composer_sends USING btree (document_id);


--
-- Name: idx_composer_sends_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_composer_sends_task ON public.composer_sends USING btree (task_id);


--
-- Name: idx_composer_sends_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_composer_sends_workspace ON public.composer_sends USING btree (workspace_id);


--
-- Name: idx_composer_snapshots_asset_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_composer_snapshots_asset_type ON public.composer_snapshots USING btree (asset_type);


--
-- Name: idx_composer_snapshots_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_composer_snapshots_campaign ON public.composer_snapshots USING btree (campaign_id);


--
-- Name: idx_composer_snapshots_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_composer_snapshots_created_at ON public.composer_snapshots USING btree (created_at);


--
-- Name: idx_composer_snapshots_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_composer_snapshots_workspace ON public.composer_snapshots USING btree (workspace_id);


--
-- Name: idx_content_ideas_framework; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_ideas_framework ON public.content_ideas USING btree (framework) WHERE (framework IS NOT NULL);


--
-- Name: idx_content_ideas_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_ideas_pending ON public.content_ideas USING btree (workspace_id, generated_at) WHERE (status = 'pending'::text);


--
-- Name: idx_content_ideas_workspace_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_ideas_workspace_status ON public.content_ideas USING btree (workspace_id, status);


--
-- Name: idx_content_ideas_workspace_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_ideas_workspace_type ON public.content_ideas USING btree (workspace_id, content_type);


--
-- Name: idx_cost_forecasts_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_forecasts_date ON public.cost_forecasts USING btree (workspace_id, forecast_date);


--
-- Name: idx_cost_forecasts_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_forecasts_workspace ON public.cost_forecasts USING btree (workspace_id);


--
-- Name: idx_creator_earnings_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creator_earnings_creator ON public.creator_earnings USING btree (creator_id);


--
-- Name: idx_creator_earnings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creator_earnings_status ON public.creator_earnings USING btree (status);


--
-- Name: idx_custom_roles_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_roles_workspace ON public.custom_roles USING btree (workspace_id);


--
-- Name: idx_deck_slides_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deck_slides_asset ON public.deck_slides USING btree (asset_id);


--
-- Name: idx_deck_slides_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deck_slides_order ON public.deck_slides USING btree (asset_id, slide_order);


--
-- Name: idx_deployments_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deployments_campaign ON public.deployments USING btree (campaign_id);


--
-- Name: idx_deployments_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deployments_idempotency ON public.deployments USING btree (idempotency_key);


--
-- Name: idx_deployments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deployments_status ON public.deployments USING btree (status);


--
-- Name: idx_design_quality_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_quality_asset ON public.design_quality_events USING btree (asset_document_id);


--
-- Name: idx_design_quality_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_quality_type ON public.design_quality_events USING btree (event_type);


--
-- Name: idx_design_quality_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_quality_workspace ON public.design_quality_events USING btree (workspace_id);


--
-- Name: idx_design_templates_aesthetic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_templates_aesthetic ON public.design_templates USING ivfflat (aesthetic_signature public.vector_cosine_ops) WITH (lists='20');


--
-- Name: idx_design_templates_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_templates_category ON public.design_templates USING btree (category);


--
-- Name: idx_design_templates_complexity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_templates_complexity ON public.design_templates USING btree (complexity_score) WHERE (complexity_score IS NOT NULL);


--
-- Name: idx_design_templates_embedding; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_templates_embedding ON public.design_templates USING hnsw (embedding public.vector_cosine_ops) WITH (m='16', ef_construction='64');


--
-- Name: idx_design_templates_industry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_templates_industry ON public.design_templates USING gin (industry);


--
-- Name: idx_design_templates_original; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_templates_original ON public.design_templates USING btree (original_template_id);


--
-- Name: idx_design_templates_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_templates_price ON public.design_templates USING btree (price_cents) WHERE (price_cents IS NOT NULL);


--
-- Name: idx_design_templates_visual_style; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_templates_visual_style ON public.design_templates USING gin (visual_style);


--
-- Name: idx_escalations_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_escalations_campaign ON public.escalations USING btree (campaign_id);


--
-- Name: idx_escalations_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_escalations_idempotency ON public.escalations USING btree (workspace_id, campaign_id, idempotency_key);


--
-- Name: idx_escalations_sako_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_escalations_sako_task ON public.escalations USING btree (sako_task_id);


--
-- Name: idx_escalations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_escalations_status ON public.escalations USING btree (status);


--
-- Name: idx_escalations_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_escalations_workspace ON public.escalations USING btree (workspace_id);


--
-- Name: idx_evidence_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evidence_workspace ON public.evidence USING btree (workspace_id);


--
-- Name: idx_exp_events_conversion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exp_events_conversion ON public.experiment_events USING btree (experiment_id, is_conversion) WHERE (is_conversion = true);


--
-- Name: idx_exp_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exp_events_created ON public.experiment_events USING btree (created_at DESC);


--
-- Name: idx_exp_events_experiment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exp_events_experiment ON public.experiment_events USING btree (experiment_id);


--
-- Name: idx_exp_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exp_events_type ON public.experiment_events USING btree (event_type);


--
-- Name: idx_exp_events_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exp_events_variant ON public.experiment_events USING btree (variant_id);


--
-- Name: idx_exp_metrics_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exp_metrics_date ON public.experiment_metrics USING btree (date DESC);


--
-- Name: idx_exp_metrics_experiment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exp_metrics_experiment ON public.experiment_metrics USING btree (experiment_id);


--
-- Name: idx_exp_metrics_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exp_metrics_variant ON public.experiment_metrics USING btree (variant_id);


--
-- Name: idx_exp_results_experiment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exp_results_experiment ON public.experiment_results USING btree (experiment_id);


--
-- Name: idx_experiments_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_experiments_campaign ON public.experiments USING btree (campaign_id);


--
-- Name: idx_experiments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_experiments_status ON public.experiments USING btree (status);


--
-- Name: idx_experiments_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_experiments_workspace ON public.experiments USING btree (workspace_id);


--
-- Name: idx_gallery_collection_items_collection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gallery_collection_items_collection ON public.gallery_collection_items USING btree (collection_id, display_order);


--
-- Name: idx_gallery_collections_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gallery_collections_published ON public.gallery_collections USING btree (is_published, display_order);


--
-- Name: idx_gallery_interactions_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gallery_interactions_campaign ON public.gallery_interactions USING btree (public_campaign_id);


--
-- Name: idx_gallery_interactions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gallery_interactions_type ON public.gallery_interactions USING btree (public_campaign_id, interaction_type);


--
-- Name: idx_gallery_interactions_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gallery_interactions_workspace ON public.gallery_interactions USING btree (workspace_id);


--
-- Name: idx_generated_images_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_images_brand ON public.generated_images USING btree (brand_id) WHERE (brand_id IS NOT NULL);


--
-- Name: idx_generated_images_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_images_campaign ON public.generated_images USING btree (campaign_id) WHERE (campaign_id IS NOT NULL);


--
-- Name: idx_generated_images_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_images_status ON public.generated_images USING btree (status);


--
-- Name: idx_generated_images_style; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_images_style ON public.generated_images USING btree (style);


--
-- Name: idx_generated_images_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_images_tags ON public.generated_images USING gin (tags);


--
-- Name: idx_generated_images_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_images_workspace ON public.generated_images USING btree (workspace_id);


--
-- Name: idx_generations_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generations_campaign ON public.generations USING btree (campaign_id);


--
-- Name: idx_generations_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generations_created ON public.generations USING btree (created_at DESC);


--
-- Name: idx_generations_request_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generations_request_type ON public.generations USING btree (request_type);


--
-- Name: idx_generations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generations_status ON public.generations USING btree (status);


--
-- Name: idx_generations_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generations_workspace ON public.generations USING btree (workspace_id);


--
-- Name: idx_hubspot_contacts_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hubspot_contacts_email ON public.hubspot_contacts USING btree (workspace_id, email);


--
-- Name: idx_hubspot_contacts_lifecycle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hubspot_contacts_lifecycle ON public.hubspot_contacts USING btree (workspace_id, lifecycle_stage);


--
-- Name: idx_hubspot_contacts_lists; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hubspot_contacts_lists ON public.hubspot_contacts USING gin (list_ids);


--
-- Name: idx_hubspot_contacts_synced; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hubspot_contacts_synced ON public.hubspot_contacts USING btree (workspace_id, synced_at);


--
-- Name: idx_hubspot_contacts_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hubspot_contacts_workspace ON public.hubspot_contacts USING btree (workspace_id);


--
-- Name: idx_hubspot_lists_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hubspot_lists_workspace ON public.hubspot_lists USING btree (workspace_id);


--
-- Name: idx_hubspot_sync_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hubspot_sync_jobs_status ON public.hubspot_sync_jobs USING btree (workspace_id, status);


--
-- Name: idx_hubspot_sync_jobs_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hubspot_sync_jobs_workspace ON public.hubspot_sync_jobs USING btree (workspace_id);


--
-- Name: idx_knowledge_collection_items_collection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_collection_items_collection ON public.knowledge_collection_items USING btree (collection_id);


--
-- Name: idx_knowledge_collection_items_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_collection_items_item ON public.knowledge_collection_items USING btree (item_id);


--
-- Name: idx_knowledge_collections_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_collections_parent ON public.knowledge_collections USING btree (parent_id) WHERE (parent_id IS NOT NULL);


--
-- Name: idx_knowledge_collections_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_collections_workspace ON public.knowledge_collections USING btree (workspace_id);


--
-- Name: idx_knowledge_items_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_items_parent ON public.knowledge_items USING btree (parent_id) WHERE (parent_id IS NOT NULL);


--
-- Name: idx_knowledge_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_items_status ON public.knowledge_items USING btree (workspace_id, status);


--
-- Name: idx_knowledge_items_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_items_tags ON public.knowledge_items USING gin (tags);


--
-- Name: idx_knowledge_items_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_items_type ON public.knowledge_items USING btree (workspace_id, content_type);


--
-- Name: idx_knowledge_items_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_items_workspace ON public.knowledge_items USING btree (workspace_id);


--
-- Name: idx_language_usage_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_language_usage_workspace ON public.language_usage_stats USING btree (workspace_id);


--
-- Name: idx_learned_sections_generation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learned_sections_generation ON public.learned_sections USING btree (generation_id);


--
-- Name: idx_learned_sections_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learned_sections_score ON public.learned_sections USING btree (acceptance_score DESC);


--
-- Name: idx_learned_sections_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learned_sections_status ON public.learned_sections USING btree (review_status);


--
-- Name: idx_legal_rules_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_legal_rules_brand ON public.legal_rules USING btree (brand_id, status);


--
-- Name: idx_legal_rules_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_legal_rules_source ON public.legal_rules USING btree (source_id);


--
-- Name: idx_legal_rules_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_legal_rules_workspace ON public.legal_rules USING btree (workspace_id, status);


--
-- Name: idx_marketplace_templates_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketplace_templates_category ON public.marketplace_templates USING btree (category, status);


--
-- Name: idx_marketplace_templates_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketplace_templates_featured ON public.marketplace_templates USING btree (is_featured, published_at DESC) WHERE (status = 'approved'::text);


--
-- Name: idx_marketplace_templates_free; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketplace_templates_free ON public.marketplace_templates USING btree (is_free, usage_count DESC) WHERE (status = 'approved'::text);


--
-- Name: idx_marketplace_templates_industry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketplace_templates_industry ON public.marketplace_templates USING btree (industry) WHERE (industry IS NOT NULL);


--
-- Name: idx_marketplace_templates_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketplace_templates_rating ON public.marketplace_templates USING btree (rating_avg DESC NULLS LAST) WHERE (status = 'approved'::text);


--
-- Name: idx_marketplace_templates_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketplace_templates_status ON public.marketplace_templates USING btree (status);


--
-- Name: idx_marketplace_templates_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketplace_templates_tags ON public.marketplace_templates USING gin (tags);


--
-- Name: idx_messages_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_campaign ON public.messages USING btree (campaign_id);


--
-- Name: idx_newsletter_ab_tests_newsletter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_newsletter_ab_tests_newsletter ON public.newsletter_ab_tests USING btree (newsletter_id);


--
-- Name: idx_newsletter_ab_tests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_newsletter_ab_tests_status ON public.newsletter_ab_tests USING btree (status);


--
-- Name: idx_newsletter_templates_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_newsletter_templates_category ON public.newsletter_templates USING btree (category);


--
-- Name: idx_newsletter_templates_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_newsletter_templates_featured ON public.newsletter_templates USING btree (is_featured) WHERE (is_featured = true);


--
-- Name: idx_newsletter_templates_public; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_newsletter_templates_public ON public.newsletter_templates USING btree (is_public) WHERE (is_public = true);


--
-- Name: idx_newsletter_templates_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_newsletter_templates_search ON public.newsletter_templates USING gin (to_tsvector('english'::regconfig, ((COALESCE(name, ''::text) || ' '::text) || COALESCE(description, ''::text))));


--
-- Name: idx_newsletter_templates_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_newsletter_templates_tags ON public.newsletter_templates USING gin (tags);


--
-- Name: idx_newsletter_templates_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_newsletter_templates_workspace ON public.newsletter_templates USING btree (workspace_id);


--
-- Name: idx_page_blocks_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_page_blocks_campaign ON public.page_blocks USING btree (campaign_id);


--
-- Name: idx_payouts_affiliate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_affiliate ON public.affiliate_payouts USING btree (affiliate_id);


--
-- Name: idx_payouts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_status ON public.affiliate_payouts USING btree (status);


--
-- Name: idx_performance_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_campaign ON public.performance USING btree (campaign_id);


--
-- Name: idx_performance_captured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_captured ON public.performance USING btree (captured_at DESC);


--
-- Name: idx_policies_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policies_version ON public.policies USING btree (workspace_id, version DESC);


--
-- Name: idx_policies_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policies_workspace ON public.policies USING btree (workspace_id);


--
-- Name: idx_positioning_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_positioning_workspace ON public.positioning_suggestions USING btree (workspace_id);


--
-- Name: idx_private_chat_messages_chat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_private_chat_messages_chat ON public.private_chat_messages USING btree (chat_id);


--
-- Name: idx_private_chat_messages_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_private_chat_messages_created ON public.private_chat_messages USING btree (created_at DESC);


--
-- Name: idx_private_chats_participants; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_private_chats_participants ON public.private_chats USING gin (participants);


--
-- Name: idx_private_chats_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_private_chats_project ON public.private_chats USING btree (project_id);


--
-- Name: idx_private_chats_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_private_chats_workspace ON public.private_chats USING btree (workspace_id);


--
-- Name: idx_product_facts_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_facts_brand ON public.product_facts USING btree (brand_id, status);


--
-- Name: idx_product_facts_fact_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_facts_fact_key ON public.product_facts USING btree (workspace_id, fact_key);


--
-- Name: idx_product_facts_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_facts_source ON public.product_facts USING btree (source_id);


--
-- Name: idx_product_facts_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_facts_workspace ON public.product_facts USING btree (workspace_id, status);


--
-- Name: idx_project_assets_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_assets_project ON public.project_assets USING btree (project_id);


--
-- Name: idx_project_assets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_assets_status ON public.project_assets USING btree (project_id, status);


--
-- Name: idx_project_assets_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_assets_type ON public.project_assets USING btree (project_id, type);


--
-- Name: idx_project_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_members_user ON public.project_members USING btree (user_id);


--
-- Name: idx_projects_canvas; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_canvas ON public.projects USING btree (canvas_id) WHERE (canvas_id IS NOT NULL);


--
-- Name: idx_projects_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_status ON public.projects USING btree (workspace_id, status);


--
-- Name: idx_projects_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_workspace ON public.projects USING btree (workspace_id);


--
-- Name: idx_provider_connections_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_connections_provider ON public.provider_connections USING btree (provider_id);


--
-- Name: idx_provider_connections_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_connections_workspace ON public.provider_connections USING btree (workspace_id);


--
-- Name: idx_provider_health_checks_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_health_checks_provider ON public.provider_health_checks USING btree (workspace_id, provider_type);


--
-- Name: idx_provider_health_checks_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_health_checks_recent ON public.provider_health_checks USING btree (workspace_id, checked_at DESC);


--
-- Name: idx_provider_health_checks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_health_checks_status ON public.provider_health_checks USING btree (workspace_id, status);


--
-- Name: idx_provider_health_checks_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_health_checks_workspace ON public.provider_health_checks USING btree (workspace_id);


--
-- Name: idx_provider_health_summary_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_health_summary_status ON public.provider_health_summary USING btree (current_status);


--
-- Name: idx_provider_health_summary_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_health_summary_workspace ON public.provider_health_summary USING btree (workspace_id);


--
-- Name: idx_provider_incidents_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_incidents_active ON public.provider_incidents USING btree (workspace_id, status) WHERE (status <> 'resolved'::text);


--
-- Name: idx_provider_incidents_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_incidents_workspace ON public.provider_incidents USING btree (workspace_id);


--
-- Name: idx_public_campaigns_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_campaigns_featured ON public.public_campaigns USING btree (is_featured, feature_order) WHERE (status = 'approved'::text);


--
-- Name: idx_public_campaigns_industry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_campaigns_industry ON public.public_campaigns USING btree (industry) WHERE (status = 'approved'::text);


--
-- Name: idx_public_campaigns_popular; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_campaigns_popular ON public.public_campaigns USING btree (view_count DESC) WHERE (status = 'approved'::text);


--
-- Name: idx_public_campaigns_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_campaigns_status ON public.public_campaigns USING btree (status);


--
-- Name: idx_public_campaigns_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_campaigns_tags ON public.public_campaigns USING gin (tags);


--
-- Name: idx_public_campaigns_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_campaigns_type ON public.public_campaigns USING btree (campaign_type) WHERE (status = 'approved'::text);


--
-- Name: idx_public_campaigns_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_campaigns_workspace ON public.public_campaigns USING btree (workspace_id);


--
-- Name: idx_published_sites_design; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_published_sites_design ON public.published_sites USING btree (design_id);


--
-- Name: idx_published_sites_subdomain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_published_sites_subdomain ON public.published_sites USING btree (subdomain);


--
-- Name: idx_published_sites_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_published_sites_workspace ON public.published_sites USING btree (workspace_id);


--
-- Name: idx_referrals_affiliate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_affiliate ON public.affiliate_referrals USING btree (affiliate_id);


--
-- Name: idx_referrals_cookie; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_cookie ON public.affiliate_referrals USING btree (cookie_id);


--
-- Name: idx_referrals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_status ON public.affiliate_referrals USING btree (status);


--
-- Name: idx_referrals_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_user ON public.affiliate_referrals USING btree (referred_user_id);


--
-- Name: idx_sako_task_activity_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sako_task_activity_task ON public.sako_task_activity USING btree (task_id);


--
-- Name: idx_sako_tasks_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sako_tasks_campaign ON public.sako_tasks USING btree (campaign_id);


--
-- Name: idx_sako_tasks_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_sako_tasks_idempotency ON public.sako_tasks USING btree (workspace_id, campaign_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: idx_sako_tasks_sako_v1_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sako_tasks_sako_v1_id ON public.sako_tasks USING btree (sako_v1_id);


--
-- Name: idx_sako_tasks_snapshot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sako_tasks_snapshot ON public.sako_tasks USING btree (snapshot_id);


--
-- Name: idx_sako_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sako_tasks_status ON public.sako_tasks USING btree (status);


--
-- Name: idx_sako_tasks_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sako_tasks_workspace ON public.sako_tasks USING btree (workspace_id);


--
-- Name: idx_saved_ad_creatives_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saved_ad_creatives_campaign ON public.saved_ad_creatives USING btree (campaign_id);


--
-- Name: idx_saved_ad_creatives_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saved_ad_creatives_created_by ON public.saved_ad_creatives USING btree (created_by);


--
-- Name: idx_saved_ad_creatives_format; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saved_ad_creatives_format ON public.saved_ad_creatives USING btree (format);


--
-- Name: idx_saved_ad_creatives_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saved_ad_creatives_platform ON public.saved_ad_creatives USING btree (platform);


--
-- Name: idx_saved_ad_creatives_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saved_ad_creatives_search ON public.saved_ad_creatives USING gin (to_tsvector('english'::regconfig, ((((COALESCE(name, ''::text) || ' '::text) || COALESCE(headline, ''::text)) || ' '::text) || COALESCE(primary_text, ''::text))));


--
-- Name: idx_saved_ad_creatives_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saved_ad_creatives_status ON public.saved_ad_creatives USING btree (status);


--
-- Name: idx_saved_ad_creatives_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saved_ad_creatives_workspace ON public.saved_ad_creatives USING btree (workspace_id);


--
-- Name: idx_saved_newsletters_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saved_newsletters_campaign ON public.saved_newsletters USING btree (campaign_id);


--
-- Name: idx_saved_newsletters_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saved_newsletters_scheduled ON public.saved_newsletters USING btree (scheduled_at) WHERE (status = 'scheduled'::text);


--
-- Name: idx_saved_newsletters_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saved_newsletters_status ON public.saved_newsletters USING btree (status);


--
-- Name: idx_saved_newsletters_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saved_newsletters_workspace ON public.saved_newsletters USING btree (workspace_id);


--
-- Name: idx_scheduled_content_idempotent; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_scheduled_content_idempotent ON public.scheduled_content USING btree (automation_rule_id, scheduled_for) WHERE (automation_rule_id IS NOT NULL);


--
-- Name: idx_scheduled_content_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_content_rule ON public.scheduled_content USING btree (automation_rule_id);


--
-- Name: idx_scheduled_content_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_content_scheduled ON public.scheduled_content USING btree (scheduled_for) WHERE (status = ANY (ARRAY['pending_review'::text, 'approved'::text]));


--
-- Name: idx_scheduled_content_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_content_status ON public.scheduled_content USING btree (workspace_id, status);


--
-- Name: idx_scheduled_content_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_content_workspace ON public.scheduled_content USING btree (workspace_id);


--
-- Name: idx_section_analytics_template_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_section_analytics_template_date ON public.section_analytics USING btree (template_id, date DESC);


--
-- Name: idx_share_comments_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_share_comments_section ON public.share_comments USING btree (share_token_id, section_id);


--
-- Name: idx_share_comments_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_share_comments_token ON public.share_comments USING btree (share_token_id);


--
-- Name: idx_share_links_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_share_links_code ON public.share_links USING btree (code);


--
-- Name: idx_share_links_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_share_links_site ON public.share_links USING btree (site_id);


--
-- Name: idx_share_views_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_share_views_session ON public.share_views USING btree (session_id);


--
-- Name: idx_share_views_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_share_views_time ON public.share_views USING btree (share_token_id, viewed_at);


--
-- Name: idx_share_views_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_share_views_token ON public.share_views USING btree (share_token_id);


--
-- Name: idx_snippet_favorites_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_snippet_favorites_user ON public.snippet_favorites USING btree (user_id);


--
-- Name: idx_snippets_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_snippets_category ON public.snippets USING btree (category);


--
-- Name: idx_snippets_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_snippets_created_by ON public.snippets USING btree (created_by);


--
-- Name: idx_snippets_public; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_snippets_public ON public.snippets USING btree (is_public);


--
-- Name: idx_snippets_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_snippets_search ON public.snippets USING gin (to_tsvector('english'::regconfig, ((COALESCE(name, ''::text) || ' '::text) || COALESCE(description, ''::text))));


--
-- Name: idx_snippets_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_snippets_type ON public.snippets USING btree (type);


--
-- Name: idx_snippets_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_snippets_workspace ON public.snippets USING btree (workspace_id);


--
-- Name: idx_social_calendars_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_calendars_brand ON public.social_calendars USING btree (brand_id);


--
-- Name: idx_social_calendars_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_calendars_dates ON public.social_calendars USING btree (start_date, end_date);


--
-- Name: idx_social_calendars_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_calendars_workspace ON public.social_calendars USING btree (workspace_id);


--
-- Name: idx_social_posts_calendar; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_posts_calendar ON public.social_posts USING btree (calendar_id);


--
-- Name: idx_social_posts_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_posts_platform ON public.social_posts USING btree (platform);


--
-- Name: idx_social_posts_schedule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_posts_schedule ON public.social_posts USING btree (scheduled_date, scheduled_time);


--
-- Name: idx_social_posts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_posts_status ON public.social_posts USING btree (status);


--
-- Name: idx_social_posts_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_posts_workspace ON public.social_posts USING btree (workspace_id);


--
-- Name: idx_social_variants_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_variants_asset ON public.social_post_variants USING btree (asset_id);


--
-- Name: idx_social_variants_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_variants_platform ON public.social_post_variants USING btree (platform);


--
-- Name: idx_sso_config_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sso_config_workspace ON public.sso_configurations USING btree (workspace_id);


--
-- Name: idx_studio_app_runs_app; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_app_runs_app ON public.studio_app_runs USING btree (app_id);


--
-- Name: idx_studio_app_runs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_app_runs_created ON public.studio_app_runs USING btree (app_id, created_at DESC);


--
-- Name: idx_studio_app_runs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_app_runs_user ON public.studio_app_runs USING btree (user_id);


--
-- Name: idx_studio_apps_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_apps_category ON public.studio_apps USING btree (workspace_id, category);


--
-- Name: idx_studio_apps_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_apps_creator ON public.studio_apps USING btree (created_by);


--
-- Name: idx_studio_apps_visibility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_apps_visibility ON public.studio_apps USING btree (workspace_id, visibility);


--
-- Name: idx_studio_apps_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_apps_workspace ON public.studio_apps USING btree (workspace_id);


--
-- Name: idx_studio_favorites_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_favorites_user ON public.studio_app_favorites USING btree (user_id);


--
-- Name: idx_subscriptions_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_customer ON public.subscriptions USING btree (stripe_customer_id);


--
-- Name: idx_subscriptions_stripe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_stripe ON public.subscriptions USING btree (stripe_subscription_id);


--
-- Name: idx_subscriptions_stripe_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_stripe_customer ON public.subscriptions USING btree (stripe_customer_id);


--
-- Name: idx_subscriptions_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_workspace ON public.subscriptions USING btree (workspace_id);


--
-- Name: idx_supported_languages_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supported_languages_active ON public.supported_languages USING btree (is_active, tier);


--
-- Name: idx_task_composer_snapshots_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_composer_snapshots_created_at ON public.task_composer_snapshots USING btree (created_at DESC);


--
-- Name: idx_task_composer_snapshots_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_composer_snapshots_document ON public.task_composer_snapshots USING btree (document_id);


--
-- Name: idx_task_composer_snapshots_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_composer_snapshots_task ON public.task_composer_snapshots USING btree (task_id);


--
-- Name: idx_task_composer_snapshots_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_composer_snapshots_workspace ON public.task_composer_snapshots USING btree (workspace_id);


--
-- Name: idx_team_sessions_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_sessions_completed ON public.team_sessions USING btree (workspace_id, completed_at DESC) WHERE (current_phase = ANY (ARRAY['ready'::text, 'deployed'::text]));


--
-- Name: idx_team_sessions_phase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_sessions_phase ON public.team_sessions USING btree (current_phase);


--
-- Name: idx_team_sessions_review; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_sessions_review ON public.team_sessions USING btree (workspace_id) WHERE (current_phase = 'review'::text);


--
-- Name: idx_team_sessions_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_sessions_workspace ON public.team_sessions USING btree (workspace_id, started_at DESC);


--
-- Name: idx_template_acquisitions_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_acquisitions_template ON public.template_acquisitions USING btree (template_id);


--
-- Name: idx_template_acquisitions_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_acquisitions_workspace ON public.template_acquisitions USING btree (workspace_id);


--
-- Name: idx_template_purchases_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_purchases_template ON public.template_purchases USING btree (template_id);


--
-- Name: idx_template_purchases_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_purchases_user ON public.template_purchases USING btree (user_id);


--
-- Name: idx_template_reviews_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_reviews_rating ON public.template_reviews USING btree (template_id, rating);


--
-- Name: idx_template_reviews_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_reviews_template ON public.template_reviews USING btree (template_id);


--
-- Name: idx_templates_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_category ON public.templates USING btree (category);


--
-- Name: idx_templates_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_creator ON public.templates USING btree (creator_id);


--
-- Name: idx_templates_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_featured ON public.templates USING btree (is_featured) WHERE (is_featured = true);


--
-- Name: idx_templates_public; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_public ON public.templates USING btree (is_public) WHERE (is_public = true);


--
-- Name: idx_templates_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_tier ON public.templates USING btree (tier);


--
-- Name: idx_usage_aggregates_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_aggregates_period ON public.usage_aggregates USING btree (period_start DESC);


--
-- Name: idx_usage_aggregates_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_aggregates_workspace ON public.usage_aggregates USING btree (workspace_id);


--
-- Name: idx_usage_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_events_created ON public.usage_events USING btree (created_at DESC);


--
-- Name: idx_usage_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_events_type ON public.usage_events USING btree (event_type);


--
-- Name: idx_usage_events_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_events_workspace ON public.usage_events USING btree (workspace_id);


--
-- Name: idx_usage_workspace_type_period; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_usage_workspace_type_period ON public.usage_metrics USING btree (workspace_id, metric_type, period_start);


--
-- Name: idx_variants_experiment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variants_experiment ON public.experiment_variants USING btree (experiment_id);


--
-- Name: idx_video_scenes_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_video_scenes_order ON public.video_scenes USING btree (script_id, scene_order);


--
-- Name: idx_video_scenes_script; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_video_scenes_script ON public.video_scenes USING btree (script_id);


--
-- Name: idx_video_scripts_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_video_scripts_asset ON public.video_scripts USING btree (asset_id);


--
-- Name: idx_voiceovers_script; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voiceovers_script ON public.voiceovers USING btree (script_id);


--
-- Name: idx_wallet_transactions_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_transactions_workspace ON public.wallet_transactions USING btree (workspace_id, created_at DESC);


--
-- Name: idx_webhook_configurations_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_configurations_active ON public.webhook_configurations USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_webhook_configurations_events; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_configurations_events ON public.webhook_configurations USING gin (events);


--
-- Name: idx_webhook_configurations_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_configurations_provider ON public.webhook_configurations USING btree (provider);


--
-- Name: idx_webhook_configurations_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_configurations_workspace ON public.webhook_configurations USING btree (workspace_id);


--
-- Name: idx_webhook_deliveries_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_deliveries_created ON public.webhook_deliveries USING btree (created_at);


--
-- Name: idx_webhook_deliveries_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_deliveries_event ON public.webhook_deliveries USING btree (event_type);


--
-- Name: idx_webhook_deliveries_failed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_deliveries_failed ON public.webhook_deliveries USING btree (success) WHERE (success = false);


--
-- Name: idx_webhook_deliveries_webhook; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_deliveries_webhook ON public.webhook_deliveries USING btree (webhook_id);


--
-- Name: idx_website_designs_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_designs_brand ON public.website_designs USING btree (brand_id);


--
-- Name: idx_website_designs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_designs_status ON public.website_designs USING btree (status);


--
-- Name: idx_website_designs_subdomain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_designs_subdomain ON public.website_designs USING btree (subdomain);


--
-- Name: idx_website_designs_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_designs_workspace ON public.website_designs USING btree (workspace_id);


--
-- Name: idx_website_pages_design; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_pages_design ON public.website_pages USING btree (design_id);


--
-- Name: idx_website_pages_home; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_pages_home ON public.website_pages USING btree (is_home);


--
-- Name: idx_website_pages_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_pages_slug ON public.website_pages USING btree (slug);


--
-- Name: idx_workflow_node_executions_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_node_executions_run ON public.workflow_node_executions USING btree (run_id);


--
-- Name: idx_workflow_node_executions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_node_executions_status ON public.workflow_node_executions USING btree (run_id, status);


--
-- Name: idx_workflow_runs_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_runs_active ON public.workflow_runs USING btree (workflow_id, status) WHERE (status = ANY (ARRAY['running'::text, 'paused'::text]));


--
-- Name: idx_workflow_runs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_runs_status ON public.workflow_runs USING btree (status);


--
-- Name: idx_workflow_runs_workflow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_runs_workflow ON public.workflow_runs USING btree (workflow_id);


--
-- Name: idx_workflow_runs_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_runs_workspace ON public.workflow_runs USING btree (workspace_id);


--
-- Name: idx_workflow_templates_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_templates_category ON public.workflow_templates USING btree (category);


--
-- Name: idx_workflows_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflows_active ON public.workflows USING btree (workspace_id) WHERE (is_active = true);


--
-- Name: idx_workflows_templates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflows_templates ON public.workflows USING btree (is_template) WHERE (is_template = true);


--
-- Name: idx_workflows_trigger; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflows_trigger ON public.workflows USING btree (trigger_type) WHERE (is_active = true);


--
-- Name: idx_workflows_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflows_workspace ON public.workflows USING btree (workspace_id);


--
-- Name: idx_workspace_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_members_user ON public.workspace_members USING btree (user_id);


--
-- Name: idx_workspace_members_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_members_workspace ON public.workspace_members USING btree (workspace_id);


--
-- Name: idx_workspaces_settings_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_settings_gin ON public.workspaces USING gin (settings);


--
-- Name: idx_workspaces_settings_onboarding; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_settings_onboarding ON public.workspaces USING btree (((settings ->> 'onboarding_completed'::text)));


--
-- Name: idx_zapier_api_keys_prefix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zapier_api_keys_prefix ON public.zapier_api_keys USING btree (key_prefix);


--
-- Name: idx_zapier_api_keys_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zapier_api_keys_workspace ON public.zapier_api_keys USING btree (workspace_id);


--
-- Name: idx_zapier_deliveries_retry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zapier_deliveries_retry ON public.zapier_webhook_deliveries USING btree (next_retry_at) WHERE (status = 'retrying'::text);


--
-- Name: idx_zapier_deliveries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zapier_deliveries_status ON public.zapier_webhook_deliveries USING btree (status) WHERE (status = ANY (ARRAY['pending'::text, 'retrying'::text]));


--
-- Name: idx_zapier_deliveries_subscription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zapier_deliveries_subscription ON public.zapier_webhook_deliveries USING btree (subscription_id);


--
-- Name: idx_zapier_webhooks_trigger; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zapier_webhooks_trigger ON public.zapier_webhook_subscriptions USING btree (trigger_type) WHERE (is_active = true);


--
-- Name: idx_zapier_webhooks_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zapier_webhooks_workspace ON public.zapier_webhook_subscriptions USING btree (workspace_id);


--
-- Name: kit_deployments_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kit_deployments_created ON public.kit_deployments USING btree (created_at DESC);


--
-- Name: kit_deployments_kit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kit_deployments_kit_id ON public.kit_deployments USING btree (kit_id);


--
-- Name: kit_deployments_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kit_deployments_workspace ON public.kit_deployments USING btree (workspace_id);


--
-- Name: knowledge_items_embedding_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_items_embedding_idx ON public.knowledge_items USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');


--
-- Name: launch_kits_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX launch_kits_brand ON public.launch_kits USING btree (brand_id) WHERE (brand_id IS NOT NULL);


--
-- Name: launch_kits_campaign_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX launch_kits_campaign_id_key ON public.launch_kits USING btree (campaign_id) WHERE (campaign_id IS NOT NULL);


--
-- Name: launch_kits_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX launch_kits_created ON public.launch_kits USING btree (created_at DESC);


--
-- Name: launch_kits_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX launch_kits_status ON public.launch_kits USING btree (workspace_id, status);


--
-- Name: launch_kits_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX launch_kits_workspace ON public.launch_kits USING btree (workspace_id);


--
-- Name: memory_items_content_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memory_items_content_hash ON public.memory_items USING btree (content_hash);


--
-- Name: memory_items_content_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memory_items_content_type ON public.memory_items USING btree (workspace_id, content_type);


--
-- Name: memory_items_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memory_items_created_at ON public.memory_items USING btree (created_at DESC);


--
-- Name: memory_items_embedding_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memory_items_embedding_idx ON public.memory_items USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');


--
-- Name: memory_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memory_items_status ON public.memory_items USING btree (workspace_id, status);


--
-- Name: memory_items_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memory_items_workspace ON public.memory_items USING btree (workspace_id);


--
-- Name: newsletters_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX newsletters_created_at_idx ON public.newsletters USING btree (created_at DESC);


--
-- Name: newsletters_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX newsletters_status_idx ON public.newsletters USING btree (status);


--
-- Name: newsletters_workspace_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX newsletters_workspace_idx ON public.newsletters USING btree (workspace_id);


--
-- Name: page_view_events_page_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX page_view_events_page_idx ON public.page_view_events USING btree (published_page_id);


--
-- Name: page_view_events_viewed_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX page_view_events_viewed_at_idx ON public.page_view_events USING btree (viewed_at DESC);


--
-- Name: project_pages_home_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX project_pages_home_idx ON public.project_pages USING btree (project_id) WHERE (is_home = true);


--
-- Name: project_pages_project_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_pages_project_order_idx ON public.project_pages USING btree (project_id, "order");


--
-- Name: project_pages_project_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX project_pages_project_slug_idx ON public.project_pages USING btree (project_id, slug);


--
-- Name: published_pages_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX published_pages_slug_idx ON public.published_pages USING btree (slug);


--
-- Name: published_pages_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX published_pages_status_idx ON public.published_pages USING btree (status);


--
-- Name: published_pages_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX published_pages_workspace ON public.published_pages USING btree (workspace_id);


--
-- Name: published_pages_workspace_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX published_pages_workspace_idx ON public.published_pages USING btree (workspace_id);


--
-- Name: requests_assignee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX requests_assignee ON public.requests USING btree (assignee_id) WHERE (assignee_id IS NOT NULL);


--
-- Name: requests_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX requests_created_at ON public.requests USING btree (created_at DESC);


--
-- Name: requests_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX requests_due_date ON public.requests USING btree (due_date) WHERE ((due_date IS NOT NULL) AND (status <> ALL (ARRAY['done'::text, 'cancelled'::text])));


--
-- Name: requests_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX requests_requester ON public.requests USING btree (requester_id);


--
-- Name: requests_workspace_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX requests_workspace_status ON public.requests USING btree (workspace_id, status);


--
-- Name: slack_users_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX slack_users_lookup ON public.slack_users USING btree (slack_user_id);


--
-- Name: saved_ad_creatives ad_creative_version_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ad_creative_version_trigger AFTER UPDATE ON public.saved_ad_creatives FOR EACH ROW WHEN (((old.primary_text IS DISTINCT FROM new.primary_text) OR (old.headline IS DISTINCT FROM new.headline) OR (old.description IS DISTINCT FROM new.description) OR (old.media_urls IS DISTINCT FROM new.media_urls) OR (old.slides IS DISTINCT FROM new.slides) OR (old.script IS DISTINCT FROM new.script))) EXECUTE FUNCTION public.create_ad_creative_version();


--
-- Name: ad_creatives ad_creatives_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ad_creatives_updated_at BEFORE UPDATE ON public.ad_creatives FOR EACH ROW EXECUTE FUNCTION public.update_project_pages_updated_at();


--
-- Name: ad_format_configs ad_format_configs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ad_format_configs_updated_at BEFORE UPDATE ON public.ad_format_configs FOR EACH ROW EXECUTE FUNCTION public.update_ad_format_configs_updated_at();


--
-- Name: api_usage api_usage_update_last_used; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER api_usage_update_last_used AFTER INSERT ON public.api_usage FOR EACH ROW WHEN ((new.api_key_id IS NOT NULL)) EXECUTE FUNCTION public.update_api_key_last_used();


--
-- Name: approval_instances approval_instances_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER approval_instances_updated_at BEFORE UPDATE ON public.approval_instances FOR EACH ROW EXECUTE FUNCTION public.update_approval_templates_updated_at();


--
-- Name: approval_templates approval_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER approval_templates_updated_at BEFORE UPDATE ON public.approval_templates FOR EACH ROW EXECUTE FUNCTION public.update_approval_templates_updated_at();


--
-- Name: asset_comments asset_comments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER asset_comments_updated_at BEFORE UPDATE ON public.asset_comments FOR EACH ROW EXECUTE FUNCTION public.update_asset_comments_updated_at();


--
-- Name: audiences audiences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audiences_updated_at BEFORE UPDATE ON public.audiences FOR EACH ROW EXECUTE FUNCTION public.update_audiences_updated_at();


--
-- Name: bigquery_sync_configs bigquery_sync_configs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bigquery_sync_configs_updated_at BEFORE UPDATE ON public.bigquery_sync_configs FOR EACH ROW EXECUTE FUNCTION public.update_bigquery_sync_configs_updated_at();


--
-- Name: brands brands_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER brands_updated_at BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.update_brand_timestamp();


--
-- Name: campaigns campaign_tracking_id_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER campaign_tracking_id_trigger BEFORE INSERT ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.generate_campaign_tracking_id();


--
-- Name: canvas_elements canvas_elements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER canvas_elements_updated_at BEFORE UPDATE ON public.canvas_elements FOR EACH ROW EXECUTE FUNCTION public.update_canvas_elements_updated_at();


--
-- Name: canvases canvases_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER canvases_updated_at BEFORE UPDATE ON public.canvases FOR EACH ROW EXECUTE FUNCTION public.update_canvases_updated_at();


--
-- Name: chat_messages chat_message_auto_title; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER chat_message_auto_title AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.auto_title_chat_session();


--
-- Name: chat_messages chat_message_update_session; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER chat_message_update_session AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.update_chat_session_timestamp();


--
-- Name: content_ideas content_ideas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER content_ideas_updated_at BEFORE UPDATE ON public.content_ideas FOR EACH ROW EXECUTE FUNCTION public.update_content_ideas_updated_at();


--
-- Name: deployments deployments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER deployments_updated_at BEFORE UPDATE ON public.deployments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: escalations escalations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER escalations_updated_at BEFORE UPDATE ON public.escalations FOR EACH ROW EXECUTE FUNCTION public.update_brand_timestamp();


--
-- Name: generated_images generated_images_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER generated_images_updated_at BEFORE UPDATE ON public.generated_images FOR EACH ROW EXECUTE FUNCTION public.update_generated_images_updated_at();


--
-- Name: knowledge_items knowledge_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER knowledge_items_updated_at BEFORE UPDATE ON public.knowledge_items FOR EACH ROW EXECUTE FUNCTION public.update_knowledge_items_updated_at();


--
-- Name: launch_kits launch_kits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER launch_kits_updated_at BEFORE UPDATE ON public.launch_kits FOR EACH ROW EXECUTE FUNCTION public.update_launch_kits_updated_at();


--
-- Name: marketplace_templates marketplace_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER marketplace_templates_updated_at BEFORE UPDATE ON public.marketplace_templates FOR EACH ROW EXECUTE FUNCTION public.update_marketplace_templates_updated_at();


--
-- Name: memory_items memory_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER memory_items_updated_at BEFORE UPDATE ON public.memory_items FOR EACH ROW EXECUTE FUNCTION public.update_memory_items_updated_at();


--
-- Name: newsletter_templates newsletter_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER newsletter_templates_updated_at BEFORE UPDATE ON public.newsletter_templates FOR EACH ROW EXECUTE FUNCTION public.update_newsletter_templates_updated_at();


--
-- Name: newsletters newsletters_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER newsletters_updated_at BEFORE UPDATE ON public.newsletters FOR EACH ROW EXECUTE FUNCTION public.update_project_pages_updated_at();


--
-- Name: workspaces on_workspace_created_subscription; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_workspace_created_subscription AFTER INSERT ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.create_default_subscription();


--
-- Name: project_assets project_assets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER project_assets_updated_at BEFORE UPDATE ON public.project_assets FOR EACH ROW EXECUTE FUNCTION public.update_projects_updated_at();


--
-- Name: project_pages project_pages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER project_pages_updated_at BEFORE UPDATE ON public.project_pages FOR EACH ROW EXECUTE FUNCTION public.update_project_pages_updated_at();


--
-- Name: projects projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_projects_updated_at();


--
-- Name: provider_connections provider_connections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER provider_connections_updated_at BEFORE UPDATE ON public.provider_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: provider_health_checks provider_health_check_summary_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER provider_health_check_summary_update AFTER INSERT ON public.provider_health_checks FOR EACH ROW EXECUTE FUNCTION public.update_provider_health_summary();


--
-- Name: public_campaigns public_campaigns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER public_campaigns_updated_at BEFORE UPDATE ON public.public_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_public_campaigns_updated_at();


--
-- Name: published_pages published_pages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER published_pages_updated_at BEFORE UPDATE ON public.published_pages FOR EACH ROW EXECUTE FUNCTION public.update_project_pages_updated_at();


--
-- Name: requests requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER requests_updated_at BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.update_requests_updated_at();


--
-- Name: sako_tasks sako_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sako_tasks_updated_at BEFORE UPDATE ON public.sako_tasks FOR EACH ROW EXECUTE FUNCTION public.update_brand_timestamp();


--
-- Name: saved_ad_creatives saved_ad_creatives_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER saved_ad_creatives_updated_at BEFORE UPDATE ON public.saved_ad_creatives FOR EACH ROW EXECUTE FUNCTION public.update_saved_ad_creatives_updated_at();


--
-- Name: saved_newsletters saved_newsletters_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER saved_newsletters_updated_at BEFORE UPDATE ON public.saved_newsletters FOR EACH ROW EXECUTE FUNCTION public.update_saved_newsletters_updated_at();


--
-- Name: snippets snippets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER snippets_updated_at BEFORE UPDATE ON public.snippets FOR EACH ROW EXECUTE FUNCTION public.update_snippets_updated_at();


--
-- Name: studio_app_runs studio_app_run_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER studio_app_run_created AFTER INSERT ON public.studio_app_runs FOR EACH ROW EXECUTE FUNCTION public.increment_app_run_count();


--
-- Name: studio_apps studio_apps_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER studio_apps_updated_at BEFORE UPDATE ON public.studio_apps FOR EACH ROW EXECUTE FUNCTION public.update_studio_apps_updated_at();


--
-- Name: design_templates template_remix_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER template_remix_trigger AFTER INSERT ON public.design_templates FOR EACH ROW WHEN ((new.original_template_id IS NOT NULL)) EXECUTE FUNCTION public.increment_template_remix_count();


--
-- Name: template_reviews template_review_rating_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER template_review_rating_update AFTER INSERT OR UPDATE ON public.template_reviews FOR EACH ROW EXECUTE FUNCTION public.update_template_rating();


--
-- Name: sako_tasks track_sako_task_completion; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_sako_task_completion AFTER UPDATE ON public.sako_tasks FOR EACH ROW WHEN (((new.status = 'completed'::text) AND (old.status <> 'completed'::text))) EXECUTE FUNCTION public.update_feedback_cycle_time();


--
-- Name: asset_documents trg_asset_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_asset_documents_updated_at BEFORE UPDATE ON public.asset_documents FOR EACH ROW EXECUTE FUNCTION public.update_asset_documents_updated_at();


--
-- Name: automation_rules trg_automation_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_automation_rules_updated_at BEFORE UPDATE ON public.automation_rules FOR EACH ROW EXECUTE FUNCTION public.update_asset_documents_updated_at();


--
-- Name: brain_sources trg_brain_sources_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_brain_sources_updated_at BEFORE UPDATE ON public.brain_sources FOR EACH ROW EXECUTE FUNCTION public.update_asset_documents_updated_at();


--
-- Name: brand_memory trg_brand_memory_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_brand_memory_updated_at BEFORE UPDATE ON public.brand_memory FOR EACH ROW EXECUTE FUNCTION public.update_asset_documents_updated_at();


--
-- Name: legal_rules trg_legal_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_legal_rules_updated_at BEFORE UPDATE ON public.legal_rules FOR EACH ROW EXECUTE FUNCTION public.update_asset_documents_updated_at();


--
-- Name: product_facts trg_product_facts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_facts_updated_at BEFORE UPDATE ON public.product_facts FOR EACH ROW EXECUTE FUNCTION public.update_asset_documents_updated_at();


--
-- Name: website_designs trigger_increment_design_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_increment_design_version BEFORE UPDATE OF sections, global_styles ON public.website_designs FOR EACH ROW EXECUTE FUNCTION public.increment_design_version();


--
-- Name: affiliate_commissions trigger_update_affiliate_earnings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_affiliate_earnings AFTER INSERT OR UPDATE ON public.affiliate_commissions FOR EACH ROW EXECUTE FUNCTION public.update_affiliate_earnings();


--
-- Name: affiliate_referrals trigger_update_affiliate_stats; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_affiliate_stats AFTER INSERT OR UPDATE ON public.affiliate_referrals FOR EACH ROW EXECUTE FUNCTION public.update_affiliate_stats();


--
-- Name: social_posts trigger_update_calendar_stats; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_calendar_stats AFTER INSERT OR DELETE OR UPDATE ON public.social_posts FOR EACH ROW EXECUTE FUNCTION public.update_calendar_stats();


--
-- Name: private_chat_messages trigger_update_chat_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_chat_timestamp AFTER INSERT ON public.private_chat_messages FOR EACH ROW EXECUTE FUNCTION public.update_chat_timestamp();


--
-- Name: campaign_assets update_campaign_assets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_campaign_assets_updated_at BEFORE UPDATE ON public.campaign_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: campaigns update_campaigns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: claim_packs update_claim_packs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_claim_packs_updated_at BEFORE UPDATE ON public.claim_packs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: claim_performance update_claim_performance_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_claim_performance_updated_at BEFORE UPDATE ON public.claim_performance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: claims update_claims_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_claims_updated_at BEFORE UPDATE ON public.claims FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: deployments update_deployments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_deployments_updated_at BEFORE UPDATE ON public.deployments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: followup_flows update_followup_flows_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_followup_flows_updated_at BEFORE UPDATE ON public.followup_flows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: hubspot_connections update_hubspot_connections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_hubspot_connections_updated_at BEFORE UPDATE ON public.hubspot_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: messages update_messages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: page_blocks update_page_blocks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_page_blocks_updated_at BEFORE UPDATE ON public.page_blocks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: policies update_policies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_policies_updated_at BEFORE UPDATE ON public.policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: workspace_members update_workspace_members_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_workspace_members_updated_at BEFORE UPDATE ON public.workspace_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: workspace_settings update_workspace_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_workspace_settings_updated_at BEFORE UPDATE ON public.workspace_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: workspaces update_workspaces_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: webhook_configurations webhook_configurations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER webhook_configurations_updated_at BEFORE UPDATE ON public.webhook_configurations FOR EACH ROW EXECUTE FUNCTION public.update_webhook_configurations_updated_at();


--
-- Name: workflow_runs workflow_run_stats_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER workflow_run_stats_update AFTER UPDATE ON public.workflow_runs FOR EACH ROW EXECUTE FUNCTION public.update_workflow_run_stats();


--
-- Name: workflows workflows_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER workflows_updated_at BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION public.update_workflows_updated_at();


--
-- Name: ad_ab_tests ad_ab_tests_variant_a_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_ab_tests
    ADD CONSTRAINT ad_ab_tests_variant_a_id_fkey FOREIGN KEY (variant_a_id) REFERENCES public.saved_ad_creatives(id) ON DELETE CASCADE;


--
-- Name: ad_ab_tests ad_ab_tests_variant_b_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_ab_tests
    ADD CONSTRAINT ad_ab_tests_variant_b_id_fkey FOREIGN KEY (variant_b_id) REFERENCES public.saved_ad_creatives(id) ON DELETE CASCADE;


--
-- Name: ad_ab_tests ad_ab_tests_winner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_ab_tests
    ADD CONSTRAINT ad_ab_tests_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.saved_ad_creatives(id);


--
-- Name: ad_ab_tests ad_ab_tests_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_ab_tests
    ADD CONSTRAINT ad_ab_tests_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: ad_creative_versions ad_creative_versions_creative_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_creative_versions
    ADD CONSTRAINT ad_creative_versions_creative_id_fkey FOREIGN KEY (creative_id) REFERENCES public.saved_ad_creatives(id) ON DELETE CASCADE;


--
-- Name: ad_creatives ad_creatives_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_creatives
    ADD CONSTRAINT ad_creatives_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: ad_creatives ad_creatives_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_creatives
    ADD CONSTRAINT ad_creatives_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: ad_creatives ad_creatives_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_creatives
    ADD CONSTRAINT ad_creatives_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: ad_format_configs ad_format_configs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_format_configs
    ADD CONSTRAINT ad_format_configs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: affiliate_commissions affiliate_commissions_affiliate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_commissions
    ADD CONSTRAINT affiliate_commissions_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id) ON DELETE CASCADE;


--
-- Name: affiliate_commissions affiliate_commissions_payout_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_commissions
    ADD CONSTRAINT affiliate_commissions_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES public.affiliate_payouts(id);


--
-- Name: affiliate_commissions affiliate_commissions_referral_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_commissions
    ADD CONSTRAINT affiliate_commissions_referral_id_fkey FOREIGN KEY (referral_id) REFERENCES public.affiliate_referrals(id) ON DELETE CASCADE;


--
-- Name: affiliate_payouts affiliate_payouts_affiliate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_payouts
    ADD CONSTRAINT affiliate_payouts_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id) ON DELETE CASCADE;


--
-- Name: affiliate_referrals affiliate_referrals_affiliate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_referrals
    ADD CONSTRAINT affiliate_referrals_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id) ON DELETE CASCADE;


--
-- Name: affiliate_referrals affiliate_referrals_referred_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_referrals
    ADD CONSTRAINT affiliate_referrals_referred_user_id_fkey FOREIGN KEY (referred_user_id) REFERENCES auth.users(id);


--
-- Name: affiliates affiliates_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliates
    ADD CONSTRAINT affiliates_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: affiliates affiliates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliates
    ADD CONSTRAINT affiliates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: agent_runs agent_runs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_runs
    ADD CONSTRAINT agent_runs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: ai_traces ai_traces_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_traces
    ADD CONSTRAINT ai_traces_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: angles angles_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.angles
    ADD CONSTRAINT angles_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: api_keys api_keys_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: api_keys api_keys_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: api_usage api_usage_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_usage
    ADD CONSTRAINT api_usage_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES public.api_keys(id) ON DELETE SET NULL;


--
-- Name: api_usage api_usage_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_usage
    ADD CONSTRAINT api_usage_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: approval_decisions approval_decisions_decision_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_decisions
    ADD CONSTRAINT approval_decisions_decision_by_fkey FOREIGN KEY (decision_by) REFERENCES auth.users(id);


--
-- Name: approval_decisions approval_decisions_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_decisions
    ADD CONSTRAINT approval_decisions_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.approval_instances(id) ON DELETE CASCADE;


--
-- Name: approval_instances approval_instances_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_instances
    ADD CONSTRAINT approval_instances_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: approval_instances approval_instances_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_instances
    ADD CONSTRAINT approval_instances_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES auth.users(id);


--
-- Name: approval_instances approval_instances_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_instances
    ADD CONSTRAINT approval_instances_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.approval_templates(id) ON DELETE SET NULL;


--
-- Name: approval_instances approval_instances_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_instances
    ADD CONSTRAINT approval_instances_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: approval_requests approval_requests_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: approval_templates approval_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_templates
    ADD CONSTRAINT approval_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: approval_templates approval_templates_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_templates
    ADD CONSTRAINT approval_templates_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: approvals approvals_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.claims(id) ON DELETE CASCADE;


--
-- Name: assembled_videos assembled_videos_script_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assembled_videos
    ADD CONSTRAINT assembled_videos_script_id_fkey FOREIGN KEY (script_id) REFERENCES public.video_scripts(id) ON DELETE CASCADE;


--
-- Name: assembled_videos assembled_videos_voiceover_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assembled_videos
    ADD CONSTRAINT assembled_videos_voiceover_id_fkey FOREIGN KEY (voiceover_id) REFERENCES public.voiceovers(id);


--
-- Name: asset_comments asset_comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_comments
    ADD CONSTRAINT asset_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.asset_comments(id) ON DELETE CASCADE;


--
-- Name: asset_comments asset_comments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_comments
    ADD CONSTRAINT asset_comments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: asset_comments asset_comments_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_comments
    ADD CONSTRAINT asset_comments_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: asset_documents asset_documents_brain_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_documents
    ADD CONSTRAINT asset_documents_brain_snapshot_id_fkey FOREIGN KEY (brain_snapshot_id) REFERENCES public.brain_snapshots(id) ON DELETE SET NULL;


--
-- Name: asset_documents asset_documents_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_documents
    ADD CONSTRAINT asset_documents_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: asset_documents asset_documents_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_documents
    ADD CONSTRAINT asset_documents_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: asset_documents asset_documents_parent_revision_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_documents
    ADD CONSTRAINT asset_documents_parent_revision_id_fkey FOREIGN KEY (parent_revision_id) REFERENCES public.asset_documents(id) ON DELETE SET NULL;


--
-- Name: asset_documents asset_documents_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_documents
    ADD CONSTRAINT asset_documents_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: asset_renders asset_renders_asset_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_renders
    ADD CONSTRAINT asset_renders_asset_document_id_fkey FOREIGN KEY (asset_document_id) REFERENCES public.asset_documents(id) ON DELETE CASCADE;


--
-- Name: asset_renders asset_renders_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_renders
    ADD CONSTRAINT asset_renders_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: audiences audiences_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audiences
    ADD CONSTRAINT audiences_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: audit_log audit_log_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: automation_rules automation_rules_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_rules
    ADD CONSTRAINT automation_rules_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;


--
-- Name: automation_rules automation_rules_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_rules
    ADD CONSTRAINT automation_rules_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: automation_runs automation_runs_automation_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_runs
    ADD CONSTRAINT automation_runs_automation_rule_id_fkey FOREIGN KEY (automation_rule_id) REFERENCES public.automation_rules(id) ON DELETE CASCADE;


--
-- Name: automation_runs automation_runs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_runs
    ADD CONSTRAINT automation_runs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: battle_cards battle_cards_competitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.battle_cards
    ADD CONSTRAINT battle_cards_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id) ON DELETE CASCADE;


--
-- Name: battle_cards battle_cards_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.battle_cards
    ADD CONSTRAINT battle_cards_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: bigquery_sync_configs bigquery_sync_configs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bigquery_sync_configs
    ADD CONSTRAINT bigquery_sync_configs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: bigquery_sync_history bigquery_sync_history_sync_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bigquery_sync_history
    ADD CONSTRAINT bigquery_sync_history_sync_config_id_fkey FOREIGN KEY (sync_config_id) REFERENCES public.bigquery_sync_configs(id) ON DELETE CASCADE;


--
-- Name: brain_learning_runs brain_learning_runs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_learning_runs
    ADD CONSTRAINT brain_learning_runs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: brain_snapshots brain_snapshots_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_snapshots
    ADD CONSTRAINT brain_snapshots_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;


--
-- Name: brain_snapshots brain_snapshots_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_snapshots
    ADD CONSTRAINT brain_snapshots_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: brain_sources brain_sources_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_sources
    ADD CONSTRAINT brain_sources_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;


--
-- Name: brain_sources brain_sources_last_snapshot_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_sources
    ADD CONSTRAINT brain_sources_last_snapshot_fk FOREIGN KEY (last_snapshot_id) REFERENCES public.brain_snapshots(id) ON DELETE SET NULL;


--
-- Name: brain_sources brain_sources_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_sources
    ADD CONSTRAINT brain_sources_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: brain_sync_runs brain_sync_runs_brain_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_sync_runs
    ADD CONSTRAINT brain_sync_runs_brain_source_id_fkey FOREIGN KEY (brain_source_id) REFERENCES public.brain_sources(id) ON DELETE CASCADE;


--
-- Name: brain_sync_runs brain_sync_runs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_sync_runs
    ADD CONSTRAINT brain_sync_runs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: brand_assets brand_assets_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_assets
    ADD CONSTRAINT brand_assets_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;


--
-- Name: brand_memory brand_memory_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_memory
    ADD CONSTRAINT brand_memory_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;


--
-- Name: brand_memory brand_memory_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_memory
    ADD CONSTRAINT brand_memory_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: brands brands_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: budget_alert_history budget_alert_history_alert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_alert_history
    ADD CONSTRAINT budget_alert_history_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES public.budget_alerts(id) ON DELETE CASCADE;


--
-- Name: budget_alert_history budget_alert_history_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_alert_history
    ADD CONSTRAINT budget_alert_history_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: budget_alerts budget_alerts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_alerts
    ADD CONSTRAINT budget_alerts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: budget_alerts budget_alerts_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_alerts
    ADD CONSTRAINT budget_alerts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: campaign_assets campaign_assets_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_assets
    ADD CONSTRAINT campaign_assets_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_assets campaign_assets_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_assets
    ADD CONSTRAINT campaign_assets_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: campaign_claim_links campaign_claim_links_asset_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_claim_links
    ADD CONSTRAINT campaign_claim_links_asset_document_id_fkey FOREIGN KEY (asset_document_id) REFERENCES public.asset_documents(id) ON DELETE CASCADE;


--
-- Name: campaign_claim_links campaign_claim_links_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_claim_links
    ADD CONSTRAINT campaign_claim_links_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_claim_links campaign_claim_links_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_claim_links
    ADD CONSTRAINT campaign_claim_links_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.claims(id) ON DELETE CASCADE;


--
-- Name: campaign_claim_links campaign_claim_links_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_claim_links
    ADD CONSTRAINT campaign_claim_links_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: campaign_claim_links campaign_claim_links_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_claim_links
    ADD CONSTRAINT campaign_claim_links_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: campaign_fact_citations campaign_fact_citations_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_fact_citations
    ADD CONSTRAINT campaign_fact_citations_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_fact_citations campaign_fact_citations_fact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_fact_citations
    ADD CONSTRAINT campaign_fact_citations_fact_id_fkey FOREIGN KEY (fact_id) REFERENCES public.product_facts(id) ON DELETE CASCADE;


--
-- Name: campaign_fact_citations campaign_fact_citations_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_fact_citations
    ADD CONSTRAINT campaign_fact_citations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: campaign_targeting_rules campaign_targeting_rules_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_targeting_rules
    ADD CONSTRAINT campaign_targeting_rules_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_targeting_rules campaign_targeting_rules_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_targeting_rules
    ADD CONSTRAINT campaign_targeting_rules_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: campaign_versions campaign_versions_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_versions
    ADD CONSTRAINT campaign_versions_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_versions campaign_versions_parent_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_versions
    ADD CONSTRAINT campaign_versions_parent_version_id_fkey FOREIGN KEY (parent_version_id) REFERENCES public.campaign_versions(id) ON DELETE SET NULL;


--
-- Name: campaigns campaigns_approval_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_approval_template_id_fkey FOREIGN KEY (approval_template_id) REFERENCES public.approval_templates(id) ON DELETE SET NULL;


--
-- Name: campaigns campaigns_audience_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_audience_id_fkey FOREIGN KEY (audience_id) REFERENCES public.audiences(id) ON DELETE SET NULL;


--
-- Name: campaigns campaigns_brain_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_brain_snapshot_id_fkey FOREIGN KEY (brain_snapshot_id) REFERENCES public.brain_snapshots(id) ON DELETE SET NULL;


--
-- Name: campaigns campaigns_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: campaigns campaigns_landing_design_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_landing_design_id_fkey FOREIGN KEY (landing_design_id) REFERENCES public.website_designs(id) ON DELETE SET NULL;


--
-- Name: campaigns campaigns_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: cancellation_feedback cancellation_feedback_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cancellation_feedback
    ADD CONSTRAINT cancellation_feedback_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: canvas_comments canvas_comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_comments
    ADD CONSTRAINT canvas_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id);


--
-- Name: canvas_comments canvas_comments_canvas_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_comments
    ADD CONSTRAINT canvas_comments_canvas_id_fkey FOREIGN KEY (canvas_id) REFERENCES public.canvases(id) ON DELETE CASCADE;


--
-- Name: canvas_comments canvas_comments_parent_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_comments
    ADD CONSTRAINT canvas_comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.canvas_comments(id) ON DELETE CASCADE;


--
-- Name: canvas_comments canvas_comments_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_comments
    ADD CONSTRAINT canvas_comments_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id);


--
-- Name: canvas_elements canvas_elements_canvas_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_elements
    ADD CONSTRAINT canvas_elements_canvas_id_fkey FOREIGN KEY (canvas_id) REFERENCES public.canvases(id) ON DELETE CASCADE;


--
-- Name: canvas_elements canvas_elements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_elements
    ADD CONSTRAINT canvas_elements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: canvas_elements canvas_elements_locked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_elements
    ADD CONSTRAINT canvas_elements_locked_by_fkey FOREIGN KEY (locked_by) REFERENCES auth.users(id);


--
-- Name: canvas_presence canvas_presence_canvas_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_presence
    ADD CONSTRAINT canvas_presence_canvas_id_fkey FOREIGN KEY (canvas_id) REFERENCES public.canvases(id) ON DELETE CASCADE;


--
-- Name: canvas_presence canvas_presence_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_presence
    ADD CONSTRAINT canvas_presence_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: canvas_versions canvas_versions_canvas_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_versions
    ADD CONSTRAINT canvas_versions_canvas_id_fkey FOREIGN KEY (canvas_id) REFERENCES public.canvases(id) ON DELETE CASCADE;


--
-- Name: canvas_versions canvas_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_versions
    ADD CONSTRAINT canvas_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: canvases canvases_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvases
    ADD CONSTRAINT canvases_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: canvases canvases_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvases
    ADD CONSTRAINT canvases_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: canvases canvases_last_edited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvases
    ADD CONSTRAINT canvases_last_edited_by_fkey FOREIGN KEY (last_edited_by) REFERENCES auth.users(id);


--
-- Name: canvases canvases_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvases
    ADD CONSTRAINT canvases_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE;


--
-- Name: chat_sessions chat_sessions_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: chat_sessions chat_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_sessions chat_sessions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: claim_evidence_links claim_evidence_links_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_evidence_links
    ADD CONSTRAINT claim_evidence_links_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.claims(id) ON DELETE CASCADE;


--
-- Name: claim_evidence_links claim_evidence_links_evidence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_evidence_links
    ADD CONSTRAINT claim_evidence_links_evidence_id_fkey FOREIGN KEY (evidence_id) REFERENCES public.evidence(id) ON DELETE CASCADE;


--
-- Name: claim_packs claim_packs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_packs
    ADD CONSTRAINT claim_packs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: claim_performance claim_performance_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_performance
    ADD CONSTRAINT claim_performance_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: claim_performance claim_performance_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_performance
    ADD CONSTRAINT claim_performance_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.claims(id) ON DELETE SET NULL;


--
-- Name: claim_performance claim_performance_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_performance
    ADD CONSTRAINT claim_performance_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: claims claims_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: comment_notifications comment_notifications_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comment_notifications
    ADD CONSTRAINT comment_notifications_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.asset_comments(id) ON DELETE CASCADE;


--
-- Name: comment_reactions comment_reactions_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comment_reactions
    ADD CONSTRAINT comment_reactions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.asset_comments(id) ON DELETE CASCADE;


--
-- Name: competitors competitors_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitors
    ADD CONSTRAINT competitors_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: composer_document_versions composer_document_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_document_versions
    ADD CONSTRAINT composer_document_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: composer_document_versions composer_document_versions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_document_versions
    ADD CONSTRAINT composer_document_versions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.composer_documents(id) ON DELETE CASCADE;


--
-- Name: composer_document_versions composer_document_versions_source_campaign_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_document_versions
    ADD CONSTRAINT composer_document_versions_source_campaign_version_id_fkey FOREIGN KEY (source_campaign_version_id) REFERENCES public.campaign_versions(id) ON DELETE SET NULL;


--
-- Name: composer_document_versions composer_document_versions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_document_versions
    ADD CONSTRAINT composer_document_versions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: composer_documents composer_documents_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_documents
    ADD CONSTRAINT composer_documents_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: composer_documents composer_documents_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_documents
    ADD CONSTRAINT composer_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: composer_documents composer_documents_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_documents
    ADD CONSTRAINT composer_documents_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: composer_feedback_events composer_feedback_events_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_feedback_events
    ADD CONSTRAINT composer_feedback_events_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: composer_feedback_events composer_feedback_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_feedback_events
    ADD CONSTRAINT composer_feedback_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: composer_feedback_events composer_feedback_events_escalation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_feedback_events
    ADD CONSTRAINT composer_feedback_events_escalation_id_fkey FOREIGN KEY (escalation_id) REFERENCES public.escalations(id) ON DELETE SET NULL;


--
-- Name: composer_feedback_events composer_feedback_events_sako_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_feedback_events
    ADD CONSTRAINT composer_feedback_events_sako_task_id_fkey FOREIGN KEY (sako_task_id) REFERENCES public.sako_tasks(id) ON DELETE CASCADE;


--
-- Name: composer_feedback_events composer_feedback_events_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_feedback_events
    ADD CONSTRAINT composer_feedback_events_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.composer_snapshots(id) ON DELETE SET NULL;


--
-- Name: composer_feedback_events composer_feedback_events_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_feedback_events
    ADD CONSTRAINT composer_feedback_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: composer_sends composer_sends_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_sends
    ADD CONSTRAINT composer_sends_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: composer_sends composer_sends_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_sends
    ADD CONSTRAINT composer_sends_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.composer_documents(id) ON DELETE CASCADE;


--
-- Name: composer_sends composer_sends_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_sends
    ADD CONSTRAINT composer_sends_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.sako_tasks(id) ON DELETE SET NULL;


--
-- Name: composer_sends composer_sends_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_sends
    ADD CONSTRAINT composer_sends_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.composer_document_versions(id) ON DELETE CASCADE;


--
-- Name: composer_sends composer_sends_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_sends
    ADD CONSTRAINT composer_sends_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: composer_snapshots composer_snapshots_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_snapshots
    ADD CONSTRAINT composer_snapshots_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: composer_snapshots composer_snapshots_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_snapshots
    ADD CONSTRAINT composer_snapshots_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: composer_snapshots composer_snapshots_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composer_snapshots
    ADD CONSTRAINT composer_snapshots_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: content_ideas content_ideas_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_ideas
    ADD CONSTRAINT content_ideas_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: content_ideas content_ideas_used_in_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_ideas
    ADD CONSTRAINT content_ideas_used_in_campaign_id_fkey FOREIGN KEY (used_in_campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: content_ideas content_ideas_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_ideas
    ADD CONSTRAINT content_ideas_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: cost_forecasts cost_forecasts_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_forecasts
    ADD CONSTRAINT cost_forecasts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: creator_earnings creator_earnings_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_earnings
    ADD CONSTRAINT creator_earnings_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.template_purchases(id) ON DELETE CASCADE;


--
-- Name: creator_earnings creator_earnings_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_earnings
    ADD CONSTRAINT creator_earnings_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.design_templates(id) ON DELETE CASCADE;


--
-- Name: custom_roles custom_roles_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_roles
    ADD CONSTRAINT custom_roles_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: deck_slides deck_slides_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deck_slides
    ADD CONSTRAINT deck_slides_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.campaign_assets(id) ON DELETE CASCADE;


--
-- Name: deployments deployments_angle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployments
    ADD CONSTRAINT deployments_angle_id_fkey FOREIGN KEY (angle_id) REFERENCES public.angles(id) ON DELETE SET NULL;


--
-- Name: deployments deployments_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployments
    ADD CONSTRAINT deployments_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: design_quality_events design_quality_events_asset_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_quality_events
    ADD CONSTRAINT design_quality_events_asset_document_id_fkey FOREIGN KEY (asset_document_id) REFERENCES public.asset_documents(id) ON DELETE SET NULL;


--
-- Name: design_quality_events design_quality_events_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_quality_events
    ADD CONSTRAINT design_quality_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: design_templates design_templates_original_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_templates
    ADD CONSTRAINT design_templates_original_template_id_fkey FOREIGN KEY (original_template_id) REFERENCES public.design_templates(id);


--
-- Name: escalations escalations_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escalations
    ADD CONSTRAINT escalations_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: escalations escalations_sako_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escalations
    ADD CONSTRAINT escalations_sako_task_id_fkey FOREIGN KEY (sako_task_id) REFERENCES public.sako_tasks(id) ON DELETE SET NULL;


--
-- Name: escalations escalations_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escalations
    ADD CONSTRAINT escalations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: evidence evidence_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence
    ADD CONSTRAINT evidence_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: experiment_assignments experiment_assignments_experiment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experiment_assignments
    ADD CONSTRAINT experiment_assignments_experiment_id_fkey FOREIGN KEY (experiment_id) REFERENCES public.experiments(id) ON DELETE CASCADE;


--
-- Name: experiment_assignments experiment_assignments_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experiment_assignments
    ADD CONSTRAINT experiment_assignments_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.experiment_variants(id) ON DELETE CASCADE;


--
-- Name: experiment_events experiment_events_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experiment_events
    ADD CONSTRAINT experiment_events_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.experiment_assignments(id) ON DELETE SET NULL;


--
-- Name: experiment_events experiment_events_experiment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experiment_events
    ADD CONSTRAINT experiment_events_experiment_id_fkey FOREIGN KEY (experiment_id) REFERENCES public.experiments(id) ON DELETE CASCADE;


--
-- Name: experiment_events experiment_events_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experiment_events
    ADD CONSTRAINT experiment_events_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.experiment_variants(id) ON DELETE CASCADE;


--
-- Name: experiment_metrics experiment_metrics_experiment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experiment_metrics
    ADD CONSTRAINT experiment_metrics_experiment_id_fkey FOREIGN KEY (experiment_id) REFERENCES public.experiments(id) ON DELETE CASCADE;


--
-- Name: experiment_metrics experiment_metrics_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experiment_metrics
    ADD CONSTRAINT experiment_metrics_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.experiment_variants(id) ON DELETE CASCADE;


--
-- Name: experiment_results experiment_results_control_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experiment_results
    ADD CONSTRAINT experiment_results_control_variant_id_fkey FOREIGN KEY (control_variant_id) REFERENCES public.experiment_variants(id);


--
-- Name: experiment_results experiment_results_experiment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experiment_results
    ADD CONSTRAINT experiment_results_experiment_id_fkey FOREIGN KEY (experiment_id) REFERENCES public.experiments(id) ON DELETE CASCADE;


--
-- Name: experiment_results experiment_results_test_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experiment_results
    ADD CONSTRAINT experiment_results_test_variant_id_fkey FOREIGN KEY (test_variant_id) REFERENCES public.experiment_variants(id);


--
-- Name: experiment_variants experiment_variants_experiment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experiment_variants
    ADD CONSTRAINT experiment_variants_experiment_id_fkey FOREIGN KEY (experiment_id) REFERENCES public.experiments(id) ON DELETE CASCADE;


--
-- Name: experiments experiments_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experiments
    ADD CONSTRAINT experiments_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: experiments experiments_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experiments
    ADD CONSTRAINT experiments_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: campaigns fk_selected_angle; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT fk_selected_angle FOREIGN KEY (selected_angle_id) REFERENCES public.angles(id) ON DELETE SET NULL;


--
-- Name: followup_flows followup_flows_angle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.followup_flows
    ADD CONSTRAINT followup_flows_angle_id_fkey FOREIGN KEY (angle_id) REFERENCES public.angles(id) ON DELETE SET NULL;


--
-- Name: followup_flows followup_flows_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.followup_flows
    ADD CONSTRAINT followup_flows_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: gallery_collection_items gallery_collection_items_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_collection_items
    ADD CONSTRAINT gallery_collection_items_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.gallery_collections(id) ON DELETE CASCADE;


--
-- Name: gallery_collection_items gallery_collection_items_public_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_collection_items
    ADD CONSTRAINT gallery_collection_items_public_campaign_id_fkey FOREIGN KEY (public_campaign_id) REFERENCES public.public_campaigns(id) ON DELETE CASCADE;


--
-- Name: gallery_collections gallery_collections_curated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_collections
    ADD CONSTRAINT gallery_collections_curated_by_fkey FOREIGN KEY (curated_by) REFERENCES auth.users(id);


--
-- Name: gallery_interactions gallery_interactions_public_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_interactions
    ADD CONSTRAINT gallery_interactions_public_campaign_id_fkey FOREIGN KEY (public_campaign_id) REFERENCES public.public_campaigns(id) ON DELETE CASCADE;


--
-- Name: gallery_interactions gallery_interactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_interactions
    ADD CONSTRAINT gallery_interactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: gallery_interactions gallery_interactions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_interactions
    ADD CONSTRAINT gallery_interactions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: generated_images generated_images_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_images
    ADD CONSTRAINT generated_images_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: generated_images generated_images_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_images
    ADD CONSTRAINT generated_images_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: generated_images generated_images_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_images
    ADD CONSTRAINT generated_images_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: generations generations_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generations
    ADD CONSTRAINT generations_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: generations generations_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generations
    ADD CONSTRAINT generations_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: generations generations_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generations
    ADD CONSTRAINT generations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: hubspot_connections hubspot_connections_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hubspot_connections
    ADD CONSTRAINT hubspot_connections_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: hubspot_contacts hubspot_contacts_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hubspot_contacts
    ADD CONSTRAINT hubspot_contacts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: hubspot_lists hubspot_lists_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hubspot_lists
    ADD CONSTRAINT hubspot_lists_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: hubspot_sync_jobs hubspot_sync_jobs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hubspot_sync_jobs
    ADD CONSTRAINT hubspot_sync_jobs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: kit_deployments kit_deployments_kit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kit_deployments
    ADD CONSTRAINT kit_deployments_kit_id_fkey FOREIGN KEY (kit_id) REFERENCES public.launch_kits(id) ON DELETE CASCADE;


--
-- Name: kit_deployments kit_deployments_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kit_deployments
    ADD CONSTRAINT kit_deployments_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);


--
-- Name: knowledge_collection_items knowledge_collection_items_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_collection_items
    ADD CONSTRAINT knowledge_collection_items_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.knowledge_collections(id) ON DELETE CASCADE;


--
-- Name: knowledge_collection_items knowledge_collection_items_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_collection_items
    ADD CONSTRAINT knowledge_collection_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.knowledge_items(id) ON DELETE CASCADE;


--
-- Name: knowledge_collections knowledge_collections_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_collections
    ADD CONSTRAINT knowledge_collections_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.knowledge_collections(id) ON DELETE CASCADE;


--
-- Name: knowledge_collections knowledge_collections_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_collections
    ADD CONSTRAINT knowledge_collections_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: knowledge_items knowledge_items_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_items
    ADD CONSTRAINT knowledge_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: knowledge_items knowledge_items_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_items
    ADD CONSTRAINT knowledge_items_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.knowledge_items(id) ON DELETE CASCADE;


--
-- Name: knowledge_items knowledge_items_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_items
    ADD CONSTRAINT knowledge_items_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: language_usage_stats language_usage_stats_language_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.language_usage_stats
    ADD CONSTRAINT language_usage_stats_language_code_fkey FOREIGN KEY (language_code) REFERENCES public.supported_languages(code);


--
-- Name: language_usage_stats language_usage_stats_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.language_usage_stats
    ADD CONSTRAINT language_usage_stats_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: launch_kits launch_kits_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.launch_kits
    ADD CONSTRAINT launch_kits_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id);


--
-- Name: launch_kits launch_kits_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.launch_kits
    ADD CONSTRAINT launch_kits_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: launch_kits launch_kits_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.launch_kits
    ADD CONSTRAINT launch_kits_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);


--
-- Name: learned_sections learned_sections_generation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learned_sections
    ADD CONSTRAINT learned_sections_generation_id_fkey FOREIGN KEY (generation_id) REFERENCES public.generations(id) ON DELETE CASCADE;


--
-- Name: learned_sections learned_sections_promoted_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learned_sections
    ADD CONSTRAINT learned_sections_promoted_template_id_fkey FOREIGN KEY (promoted_template_id) REFERENCES public.design_templates(id);


--
-- Name: legal_rules legal_rules_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legal_rules
    ADD CONSTRAINT legal_rules_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;


--
-- Name: legal_rules legal_rules_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legal_rules
    ADD CONSTRAINT legal_rules_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.brain_sources(id) ON DELETE SET NULL;


--
-- Name: legal_rules legal_rules_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legal_rules
    ADD CONSTRAINT legal_rules_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: marketplace_templates marketplace_templates_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_templates
    ADD CONSTRAINT marketplace_templates_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: marketplace_templates marketplace_templates_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_templates
    ADD CONSTRAINT marketplace_templates_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;


--
-- Name: memory_items memory_items_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_items
    ADD CONSTRAINT memory_items_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);


--
-- Name: message_evidence message_evidence_evidence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_evidence
    ADD CONSTRAINT message_evidence_evidence_id_fkey FOREIGN KEY (evidence_id) REFERENCES public.evidence(id) ON DELETE CASCADE;


--
-- Name: message_evidence message_evidence_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_evidence
    ADD CONSTRAINT message_evidence_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: messages messages_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: messages messages_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.claims(id) ON DELETE SET NULL;


--
-- Name: newsletter_ab_tests newsletter_ab_tests_newsletter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_ab_tests
    ADD CONSTRAINT newsletter_ab_tests_newsletter_id_fkey FOREIGN KEY (newsletter_id) REFERENCES public.saved_newsletters(id) ON DELETE CASCADE;


--
-- Name: newsletter_ab_tests newsletter_ab_tests_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_ab_tests
    ADD CONSTRAINT newsletter_ab_tests_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: newsletter_templates newsletter_templates_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_templates
    ADD CONSTRAINT newsletter_templates_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: newsletters newsletters_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletters
    ADD CONSTRAINT newsletters_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: newsletters newsletters_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletters
    ADD CONSTRAINT newsletters_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: newsletters newsletters_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletters
    ADD CONSTRAINT newsletters_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: page_blocks page_blocks_angle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_blocks
    ADD CONSTRAINT page_blocks_angle_id_fkey FOREIGN KEY (angle_id) REFERENCES public.angles(id) ON DELETE SET NULL;


--
-- Name: page_blocks page_blocks_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_blocks
    ADD CONSTRAINT page_blocks_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: page_view_events page_view_events_published_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_view_events
    ADD CONSTRAINT page_view_events_published_page_id_fkey FOREIGN KEY (published_page_id) REFERENCES public.published_pages(id) ON DELETE CASCADE;


--
-- Name: performance performance_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance
    ADD CONSTRAINT performance_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: performance performance_deployment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance
    ADD CONSTRAINT performance_deployment_id_fkey FOREIGN KEY (deployment_id) REFERENCES public.deployments(id) ON DELETE SET NULL;


--
-- Name: policies policies_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policies
    ADD CONSTRAINT policies_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: positioning_suggestions positioning_suggestions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.positioning_suggestions
    ADD CONSTRAINT positioning_suggestions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: private_chat_messages private_chat_messages_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_chat_messages
    ADD CONSTRAINT private_chat_messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.private_chats(id) ON DELETE CASCADE;


--
-- Name: private_chat_messages private_chat_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_chat_messages
    ADD CONSTRAINT private_chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: private_chats private_chats_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_chats
    ADD CONSTRAINT private_chats_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: private_chats private_chats_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_chats
    ADD CONSTRAINT private_chats_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: private_chats private_chats_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_chats
    ADD CONSTRAINT private_chats_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: product_facts product_facts_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_facts
    ADD CONSTRAINT product_facts_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;


--
-- Name: product_facts product_facts_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_facts
    ADD CONSTRAINT product_facts_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.brain_sources(id) ON DELETE SET NULL;


--
-- Name: product_facts product_facts_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_facts
    ADD CONSTRAINT product_facts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: project_assets project_assets_audience_id_override_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assets
    ADD CONSTRAINT project_assets_audience_id_override_fkey FOREIGN KEY (audience_id_override) REFERENCES public.audiences(id) ON DELETE SET NULL;


--
-- Name: project_assets project_assets_brand_id_override_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assets
    ADD CONSTRAINT project_assets_brand_id_override_fkey FOREIGN KEY (brand_id_override) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: project_assets project_assets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assets
    ADD CONSTRAINT project_assets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: project_assets project_assets_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assets
    ADD CONSTRAINT project_assets_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_members project_members_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_members project_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: project_pages project_pages_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_pages
    ADD CONSTRAINT project_pages_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: projects projects_audience_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_audience_id_fkey FOREIGN KEY (audience_id) REFERENCES public.audiences(id) ON DELETE SET NULL;


--
-- Name: projects projects_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: projects projects_canvas_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_canvas_id_fkey FOREIGN KEY (canvas_id) REFERENCES public.canvases(id) ON DELETE SET NULL;


--
-- Name: projects projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: projects projects_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: provider_connections provider_connections_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_connections
    ADD CONSTRAINT provider_connections_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: provider_health_checks provider_health_checks_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_health_checks
    ADD CONSTRAINT provider_health_checks_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: provider_health_summary provider_health_summary_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_health_summary
    ADD CONSTRAINT provider_health_summary_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: provider_incidents provider_incidents_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_incidents
    ADD CONSTRAINT provider_incidents_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id);


--
-- Name: provider_incidents provider_incidents_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_incidents
    ADD CONSTRAINT provider_incidents_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: public_campaigns public_campaigns_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_campaigns
    ADD CONSTRAINT public_campaigns_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: public_campaigns public_campaigns_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_campaigns
    ADD CONSTRAINT public_campaigns_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: public_campaigns public_campaigns_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_campaigns
    ADD CONSTRAINT public_campaigns_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: published_pages published_pages_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.published_pages
    ADD CONSTRAINT published_pages_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.project_pages(id) ON DELETE SET NULL;


--
-- Name: published_pages published_pages_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.published_pages
    ADD CONSTRAINT published_pages_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: published_pages published_pages_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.published_pages
    ADD CONSTRAINT published_pages_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: published_sites published_sites_design_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.published_sites
    ADD CONSTRAINT published_sites_design_id_fkey FOREIGN KEY (design_id) REFERENCES public.website_designs(id) ON DELETE CASCADE;


--
-- Name: published_sites published_sites_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.published_sites
    ADD CONSTRAINT published_sites_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: requests requests_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES auth.users(id);


--
-- Name: requests requests_kit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_kit_id_fkey FOREIGN KEY (kit_id) REFERENCES public.launch_kits(id);


--
-- Name: requests requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES auth.users(id);


--
-- Name: requests requests_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);


--
-- Name: sako_task_activity sako_task_activity_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sako_task_activity
    ADD CONSTRAINT sako_task_activity_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.sako_tasks(id) ON DELETE CASCADE;


--
-- Name: sako_tasks sako_tasks_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sako_tasks
    ADD CONSTRAINT sako_tasks_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: sako_tasks sako_tasks_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sako_tasks
    ADD CONSTRAINT sako_tasks_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: sako_tasks sako_tasks_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sako_tasks
    ADD CONSTRAINT sako_tasks_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: saved_ad_creatives saved_ad_creatives_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_ad_creatives
    ADD CONSTRAINT saved_ad_creatives_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: saved_ad_creatives saved_ad_creatives_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_ad_creatives
    ADD CONSTRAINT saved_ad_creatives_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: saved_newsletters saved_newsletters_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_newsletters
    ADD CONSTRAINT saved_newsletters_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: saved_newsletters saved_newsletters_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_newsletters
    ADD CONSTRAINT saved_newsletters_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.newsletter_templates(id) ON DELETE SET NULL;


--
-- Name: saved_newsletters saved_newsletters_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_newsletters
    ADD CONSTRAINT saved_newsletters_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: scheduled_content scheduled_content_asset_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_content
    ADD CONSTRAINT scheduled_content_asset_document_id_fkey FOREIGN KEY (asset_document_id) REFERENCES public.asset_documents(id) ON DELETE SET NULL;


--
-- Name: scheduled_content scheduled_content_automation_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_content
    ADD CONSTRAINT scheduled_content_automation_rule_id_fkey FOREIGN KEY (automation_rule_id) REFERENCES public.automation_rules(id) ON DELETE SET NULL;


--
-- Name: scheduled_content scheduled_content_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_content
    ADD CONSTRAINT scheduled_content_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: section_analytics section_analytics_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_analytics
    ADD CONSTRAINT section_analytics_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.design_templates(id) ON DELETE CASCADE;


--
-- Name: share_comments share_comments_parent_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_comments
    ADD CONSTRAINT share_comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.share_comments(id) ON DELETE CASCADE;


--
-- Name: share_comments share_comments_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_comments
    ADD CONSTRAINT share_comments_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id);


--
-- Name: share_comments share_comments_share_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_comments
    ADD CONSTRAINT share_comments_share_token_id_fkey FOREIGN KEY (share_token_id) REFERENCES public.share_tokens(id) ON DELETE CASCADE;


--
-- Name: share_links share_links_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_links
    ADD CONSTRAINT share_links_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.published_sites(id) ON DELETE CASCADE;


--
-- Name: share_tokens share_tokens_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_tokens
    ADD CONSTRAINT share_tokens_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: share_tokens share_tokens_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_tokens
    ADD CONSTRAINT share_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: share_tokens share_tokens_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_tokens
    ADD CONSTRAINT share_tokens_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: share_views share_views_share_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_views
    ADD CONSTRAINT share_views_share_token_id_fkey FOREIGN KEY (share_token_id) REFERENCES public.share_tokens(id) ON DELETE CASCADE;


--
-- Name: slack_users slack_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_users
    ADD CONSTRAINT slack_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: slack_users slack_users_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_users
    ADD CONSTRAINT slack_users_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);


--
-- Name: snippet_favorites snippet_favorites_snippet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snippet_favorites
    ADD CONSTRAINT snippet_favorites_snippet_id_fkey FOREIGN KEY (snippet_id) REFERENCES public.snippets(id) ON DELETE CASCADE;


--
-- Name: snippets snippets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snippets
    ADD CONSTRAINT snippets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: snippets snippets_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snippets
    ADD CONSTRAINT snippets_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: social_calendars social_calendars_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_calendars
    ADD CONSTRAINT social_calendars_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: social_calendars social_calendars_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_calendars
    ADD CONSTRAINT social_calendars_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: social_post_variants social_post_variants_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_post_variants
    ADD CONSTRAINT social_post_variants_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.campaign_assets(id) ON DELETE CASCADE;


--
-- Name: social_posts social_posts_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: social_posts social_posts_calendar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_calendar_id_fkey FOREIGN KEY (calendar_id) REFERENCES public.social_calendars(id) ON DELETE CASCADE;


--
-- Name: social_posts social_posts_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: sso_configurations sso_configurations_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sso_configurations
    ADD CONSTRAINT sso_configurations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: studio_app_favorites studio_app_favorites_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_app_favorites
    ADD CONSTRAINT studio_app_favorites_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.studio_apps(id) ON DELETE CASCADE;


--
-- Name: studio_app_favorites studio_app_favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_app_favorites
    ADD CONSTRAINT studio_app_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: studio_app_runs studio_app_runs_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_app_runs
    ADD CONSTRAINT studio_app_runs_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.studio_apps(id) ON DELETE CASCADE;


--
-- Name: studio_app_runs studio_app_runs_audience_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_app_runs
    ADD CONSTRAINT studio_app_runs_audience_id_fkey FOREIGN KEY (audience_id) REFERENCES public.audiences(id) ON DELETE SET NULL;


--
-- Name: studio_app_runs studio_app_runs_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_app_runs
    ADD CONSTRAINT studio_app_runs_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: studio_app_runs studio_app_runs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_app_runs
    ADD CONSTRAINT studio_app_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: studio_apps studio_apps_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_apps
    ADD CONSTRAINT studio_apps_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: studio_apps studio_apps_default_audience_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_apps
    ADD CONSTRAINT studio_apps_default_audience_id_fkey FOREIGN KEY (default_audience_id) REFERENCES public.audiences(id) ON DELETE SET NULL;


--
-- Name: studio_apps studio_apps_default_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_apps
    ADD CONSTRAINT studio_apps_default_brand_id_fkey FOREIGN KEY (default_brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: studio_apps studio_apps_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_apps
    ADD CONSTRAINT studio_apps_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: task_composer_snapshots task_composer_snapshots_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_composer_snapshots
    ADD CONSTRAINT task_composer_snapshots_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.composer_documents(id) ON DELETE SET NULL;


--
-- Name: task_composer_snapshots task_composer_snapshots_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_composer_snapshots
    ADD CONSTRAINT task_composer_snapshots_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.sako_tasks(id) ON DELETE CASCADE;


--
-- Name: task_composer_snapshots task_composer_snapshots_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_composer_snapshots
    ADD CONSTRAINT task_composer_snapshots_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.composer_document_versions(id) ON DELETE SET NULL;


--
-- Name: task_composer_snapshots task_composer_snapshots_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_composer_snapshots
    ADD CONSTRAINT task_composer_snapshots_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: team_sessions team_sessions_approval_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_sessions
    ADD CONSTRAINT team_sessions_approval_request_id_fkey FOREIGN KEY (approval_request_id) REFERENCES public.approval_requests(id);


--
-- Name: team_sessions team_sessions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_sessions
    ADD CONSTRAINT team_sessions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: template_acquisitions template_acquisitions_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_acquisitions
    ADD CONSTRAINT template_acquisitions_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.marketplace_templates(id) ON DELETE CASCADE;


--
-- Name: template_acquisitions template_acquisitions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_acquisitions
    ADD CONSTRAINT template_acquisitions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: template_acquisitions template_acquisitions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_acquisitions
    ADD CONSTRAINT template_acquisitions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: template_purchases template_purchases_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_purchases
    ADD CONSTRAINT template_purchases_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE CASCADE;


--
-- Name: template_purchases template_purchases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_purchases
    ADD CONSTRAINT template_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: template_reviews template_reviews_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_reviews
    ADD CONSTRAINT template_reviews_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.marketplace_templates(id) ON DELETE CASCADE;


--
-- Name: template_reviews template_reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_reviews
    ADD CONSTRAINT template_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: template_reviews template_reviews_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_reviews
    ADD CONSTRAINT template_reviews_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: templates templates_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: ui_components ui_components_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_components
    ADD CONSTRAINT ui_components_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: ui_components ui_components_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_components
    ADD CONSTRAINT ui_components_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: usage_aggregates usage_aggregates_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_aggregates
    ADD CONSTRAINT usage_aggregates_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: usage_events usage_events_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_events
    ADD CONSTRAINT usage_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: usage_metrics usage_metrics_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_metrics
    ADD CONSTRAINT usage_metrics_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: user_saved_components user_saved_components_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_saved_components
    ADD CONSTRAINT user_saved_components_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.ui_components(id) ON DELETE CASCADE;


--
-- Name: user_saved_components user_saved_components_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_saved_components
    ADD CONSTRAINT user_saved_components_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_snippets user_snippets_snippet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_snippets
    ADD CONSTRAINT user_snippets_snippet_id_fkey FOREIGN KEY (snippet_id) REFERENCES public.snippets(id) ON DELETE CASCADE;


--
-- Name: user_snippets user_snippets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_snippets
    ADD CONSTRAINT user_snippets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: video_scenes video_scenes_script_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_scenes
    ADD CONSTRAINT video_scenes_script_id_fkey FOREIGN KEY (script_id) REFERENCES public.video_scripts(id) ON DELETE CASCADE;


--
-- Name: video_scripts video_scripts_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_scripts
    ADD CONSTRAINT video_scripts_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.campaign_assets(id) ON DELETE CASCADE;


--
-- Name: voiceovers voiceovers_script_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voiceovers
    ADD CONSTRAINT voiceovers_script_id_fkey FOREIGN KEY (script_id) REFERENCES public.video_scripts(id) ON DELETE CASCADE;


--
-- Name: wallet_transactions wallet_transactions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: webhook_configurations webhook_configurations_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_configurations
    ADD CONSTRAINT webhook_configurations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: webhook_deliveries webhook_deliveries_webhook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES public.webhook_configurations(id) ON DELETE CASCADE;


--
-- Name: website_designs website_designs_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_designs
    ADD CONSTRAINT website_designs_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: website_designs website_designs_last_edited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_designs
    ADD CONSTRAINT website_designs_last_edited_by_fkey FOREIGN KEY (last_edited_by) REFERENCES auth.users(id);


--
-- Name: website_designs website_designs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_designs
    ADD CONSTRAINT website_designs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: website_designs website_designs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_designs
    ADD CONSTRAINT website_designs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: website_pages website_pages_design_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_pages
    ADD CONSTRAINT website_pages_design_id_fkey FOREIGN KEY (design_id) REFERENCES public.website_designs(id) ON DELETE CASCADE;


--
-- Name: website_pages website_pages_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_pages
    ADD CONSTRAINT website_pages_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workflow_node_executions workflow_node_executions_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_node_executions
    ADD CONSTRAINT workflow_node_executions_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.workflow_runs(id) ON DELETE CASCADE;


--
-- Name: workflow_runs workflow_runs_initiated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_initiated_by_fkey FOREIGN KEY (initiated_by) REFERENCES auth.users(id);


--
-- Name: workflow_runs workflow_runs_resumed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_resumed_by_fkey FOREIGN KEY (resumed_by) REFERENCES auth.users(id);


--
-- Name: workflow_runs workflow_runs_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;


--
-- Name: workflow_runs workflow_runs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workflows workflows_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: workflows workflows_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_custom_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_custom_role_id_fkey FOREIGN KEY (custom_role_id) REFERENCES public.custom_roles(id) ON DELETE SET NULL;


--
-- Name: workspace_members workspace_members_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_settings workspace_settings_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_settings
    ADD CONSTRAINT workspace_settings_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_wallets workspace_wallets_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_wallets
    ADD CONSTRAINT workspace_wallets_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: zapier_api_keys zapier_api_keys_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zapier_api_keys
    ADD CONSTRAINT zapier_api_keys_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: zapier_webhook_deliveries zapier_webhook_deliveries_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zapier_webhook_deliveries
    ADD CONSTRAINT zapier_webhook_deliveries_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.zapier_webhook_subscriptions(id) ON DELETE CASCADE;


--
-- Name: zapier_webhook_subscriptions zapier_webhook_subscriptions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zapier_webhook_subscriptions
    ADD CONSTRAINT zapier_webhook_subscriptions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: webhook_configurations Admins can create webhook configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create webhook configs" ON public.webhook_configurations FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = 'admin'::text)))));


--
-- Name: webhook_configurations Admins can delete webhook configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete webhook configs" ON public.webhook_configurations FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = 'admin'::text)))));


--
-- Name: zapier_api_keys Admins can manage Zapier API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage Zapier API keys" ON public.zapier_api_keys USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: ad_format_configs Admins can manage ad format configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage ad format configs" ON public.ad_format_configs USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = 'admin'::text)))));


--
-- Name: approval_templates Admins can manage approval templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage approval templates" ON public.approval_templates USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: bigquery_sync_configs Admins can manage bigquery configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage bigquery configs" ON public.bigquery_sync_configs USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = 'admin'::text)))));


--
-- Name: budget_alerts Admins can manage budget alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage budget alerts" ON public.budget_alerts USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: workspace_members Admins can manage memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage memberships" ON public.workspace_members USING (public.is_workspace_admin(workspace_id));


--
-- Name: policies Admins can manage policies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage policies" ON public.policies USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = policies.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.role = 'admin'::text)))));


--
-- Name: webhook_configurations Admins can update webhook configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update webhook configs" ON public.webhook_configurations FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = 'admin'::text)))));


--
-- Name: affiliate_commissions Affiliates can view own commissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Affiliates can view own commissions" ON public.affiliate_commissions FOR SELECT USING ((affiliate_id IN ( SELECT affiliates.id
   FROM public.affiliates
  WHERE (affiliates.user_id = auth.uid()))));


--
-- Name: affiliate_payouts Affiliates can view own payouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Affiliates can view own payouts" ON public.affiliate_payouts FOR SELECT USING ((affiliate_id IN ( SELECT affiliates.id
   FROM public.affiliates
  WHERE (affiliates.user_id = auth.uid()))));


--
-- Name: affiliate_referrals Affiliates can view own referrals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Affiliates can view own referrals" ON public.affiliate_referrals FOR SELECT USING ((affiliate_id IN ( SELECT affiliates.id
   FROM public.affiliates
  WHERE (affiliates.user_id = auth.uid()))));


--
-- Name: share_comments Anyone can add comments if allowed; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can add comments if allowed" ON public.share_comments FOR INSERT WITH CHECK ((share_token_id IN ( SELECT share_tokens.id
   FROM public.share_tokens
  WHERE ((share_tokens.allow_comments = true) AND (share_tokens.is_active = true)))));


--
-- Name: page_view_events Anyone can insert page view events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert page view events" ON public.page_view_events FOR INSERT WITH CHECK (true);


--
-- Name: affiliate_assets Anyone can view active assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active assets" ON public.affiliate_assets FOR SELECT USING ((is_active = true));


--
-- Name: published_pages Anyone can view active published pages by slug; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active published pages by slug" ON public.published_pages FOR SELECT USING ((status = 'active'::text));


--
-- Name: marketplace_templates Anyone can view approved marketplace templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view approved marketplace templates" ON public.marketplace_templates FOR SELECT USING (((status = 'approved'::text) OR (workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))));


--
-- Name: public_campaigns Anyone can view approved public campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view approved public campaigns" ON public.public_campaigns FOR SELECT USING (((status = 'approved'::text) OR (workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))));


--
-- Name: gallery_collection_items Anyone can view collection items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view collection items" ON public.gallery_collection_items FOR SELECT USING ((collection_id IN ( SELECT gallery_collections.id
   FROM public.gallery_collections
  WHERE (gallery_collections.is_published = true))));


--
-- Name: share_comments Anyone can view comments on shares they can access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view comments on shares they can access" ON public.share_comments FOR SELECT USING (true);


--
-- Name: templates Anyone can view public templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view public templates" ON public.templates FOR SELECT USING ((is_public = true));


--
-- Name: gallery_collections Anyone can view published collections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view published collections" ON public.gallery_collections FOR SELECT USING ((is_published = true));


--
-- Name: template_reviews Anyone can view visible reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view visible reviews" ON public.template_reviews FOR SELECT USING ((is_visible = true));


--
-- Name: workflow_templates Anyone can view workflow templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view workflow templates" ON public.workflow_templates FOR SELECT USING (true);


--
-- Name: private_chats Creator can delete chats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creator can delete chats" ON public.private_chats FOR DELETE USING ((auth.uid() = created_by));


--
-- Name: marketplace_templates Creators can manage their templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators can manage their templates" ON public.marketplace_templates USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: templates Creators can manage their templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators can manage their templates" ON public.templates USING ((creator_id = auth.uid()));


--
-- Name: creator_earnings Creators can view their earnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators can view their earnings" ON public.creator_earnings FOR SELECT USING ((creator_id = auth.uid()));


--
-- Name: private_chat_messages Participants can send messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can send messages" ON public.private_chat_messages FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.private_chats pc
  WHERE ((pc.id = private_chat_messages.chat_id) AND ((auth.uid() = ANY (pc.participants)) OR (auth.uid() = pc.created_by))))));


--
-- Name: private_chats Participants can update chats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can update chats" ON public.private_chats FOR UPDATE USING (((auth.uid() = ANY (participants)) OR (auth.uid() = created_by)));


--
-- Name: private_chat_messages Participants can view messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can view messages" ON public.private_chat_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.private_chats pc
  WHERE ((pc.id = private_chat_messages.chat_id) AND ((auth.uid() = ANY (pc.participants)) OR (auth.uid() = pc.created_by))))));


--
-- Name: claim_packs Public can view shared claim packs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view shared claim packs" ON public.claim_packs FOR SELECT USING (((share_token IS NOT NULL) AND ((expires_at IS NULL) OR (expires_at > now()))));


--
-- Name: approvals Reviewers can create approvals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Reviewers can create approvals" ON public.approvals FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.claims c
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((c.id = approvals.claim_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['admin'::text, 'reviewer'::text]))))));


--
-- Name: approvals Reviewers can view approvals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Reviewers can view approvals" ON public.approvals FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.claims c
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((c.id = approvals.claim_id) AND (wm.user_id = auth.uid())))));


--
-- Name: composer_feedback_events Service role can insert feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert feedback" ON public.composer_feedback_events FOR INSERT WITH CHECK (true);


--
-- Name: claim_performance Service role can manage claim performance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage claim performance" ON public.claim_performance USING ((auth.role() = 'service_role'::text));


--
-- Name: share_links Site owners can manage share links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Site owners can manage share links" ON public.share_links USING ((site_id IN ( SELECT ps.id
   FROM (public.published_sites ps
     JOIN public.workspace_members wm ON ((ps.workspace_id = wm.workspace_id)))
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: comment_notifications System can create notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can create notifications" ON public.comment_notifications FOR INSERT WITH CHECK (true);


--
-- Name: template_purchases System can create purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can create purchases" ON public.template_purchases FOR INSERT WITH CHECK (true);


--
-- Name: ad_creative_versions System can create versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can create versions" ON public.ad_creative_versions FOR INSERT WITH CHECK (true);


--
-- Name: brain_learning_runs System can insert brain learning runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert brain learning runs" ON public.brain_learning_runs FOR INSERT WITH CHECK (true);


--
-- Name: campaign_fact_citations System can insert campaign fact citations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert campaign fact citations" ON public.campaign_fact_citations FOR INSERT WITH CHECK (true);


--
-- Name: ai_traces System can insert traces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert traces" ON public.ai_traces FOR INSERT WITH CHECK (true);


--
-- Name: creator_earnings System can manage earnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can manage earnings" ON public.creator_earnings WITH CHECK (true);


--
-- Name: template_acquisitions Users can acquire templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can acquire templates" ON public.template_acquisitions FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: canvas_comments Users can add comments to accessible canvases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can add comments to accessible canvases" ON public.canvas_comments FOR INSERT WITH CHECK ((canvas_id IN ( SELECT canvases.id
   FROM public.canvases
  WHERE ((canvases.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))) OR ((canvases.is_public = true) AND (canvases.allow_comments = true))))));


--
-- Name: approval_decisions Users can add decisions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can add decisions" ON public.approval_decisions FOR INSERT WITH CHECK ((instance_id IN ( SELECT approval_instances.id
   FROM public.approval_instances
  WHERE (approval_instances.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: snippet_favorites Users can add favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can add favorites" ON public.snippet_favorites FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: comment_reactions Users can add reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can add reactions" ON public.comment_reactions FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: saved_ad_creatives Users can create ad creatives; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create ad creatives" ON public.saved_ad_creatives FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: approval_instances Users can create approval instances in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create approval instances in their workspace" ON public.approval_instances FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: studio_apps Users can create apps in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create apps in their workspace" ON public.studio_apps FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: campaign_assets Users can create assets in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create assets in their workspace" ON public.campaign_assets FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: audiences Users can create audiences in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create audiences in their workspace" ON public.audiences FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: brands Users can create brands in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create brands in their workspace" ON public.brands FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: canvases Users can create canvases in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create canvases in their workspace" ON public.canvases FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: chat_sessions Users can create chat sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create chat sessions" ON public.chat_sessions FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: asset_comments Users can create comments in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create comments in their workspace" ON public.asset_comments FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: composer_document_versions Users can create composer document versions in workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create composer document versions in workspace" ON public.composer_document_versions FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: composer_documents Users can create composer documents in workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create composer documents in workspace" ON public.composer_documents FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: composer_sends Users can create composer sends in workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create composer sends in workspace" ON public.composer_sends FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: content_ideas Users can create content ideas in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create content ideas in their workspace" ON public.content_ideas FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: escalations Users can create escalations in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create escalations in their workspace" ON public.escalations FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: generated_images Users can create images in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create images in their workspace" ON public.generated_images FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_items Users can create knowledge in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create knowledge in their workspace" ON public.knowledge_items FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: newsletter_templates Users can create newsletter templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create newsletter templates" ON public.newsletter_templates FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: private_chats Users can create private chats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create private chats" ON public.private_chats FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = private_chats.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: projects Users can create projects in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create projects in their workspace" ON public.projects FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: template_reviews Users can create reviews for acquired templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create reviews for acquired templates" ON public.template_reviews FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: studio_app_runs Users can create runs for accessible apps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create runs for accessible apps" ON public.studio_app_runs FOR INSERT WITH CHECK ((app_id IN ( SELECT studio_apps.id
   FROM public.studio_apps
  WHERE ((studio_apps.created_by = auth.uid()) OR ((studio_apps.visibility = 'workspace'::text) AND (studio_apps.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))) OR (studio_apps.visibility = 'public'::text)))));


--
-- Name: workflow_runs Users can create runs in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create runs in their workspace" ON public.workflow_runs FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: saved_newsletters Users can create saved newsletters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create saved newsletters" ON public.saved_newsletters FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: share_tokens Users can create share tokens in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create share tokens in their workspace" ON public.share_tokens FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: composer_snapshots Users can create snapshots in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create snapshots in their workspace" ON public.composer_snapshots FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: snippets Users can create snippets in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create snippets in their workspace" ON public.snippets FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_composer_snapshots Users can create task composer snapshots in workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create task composer snapshots in workspace" ON public.task_composer_snapshots FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: sako_tasks Users can create tasks in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create tasks in their workspace" ON public.sako_tasks FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workflows Users can create workflows in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create workflows in their workspace" ON public.workflows FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: ui_components Users can create workspace components; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create workspace components" ON public.ui_components FOR INSERT WITH CHECK (((workspace_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = ui_components.workspace_id) AND (wm.user_id = auth.uid()))))));


--
-- Name: ad_creatives Users can delete ad creatives in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete ad creatives in their workspace" ON public.ad_creatives FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = ad_creatives.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: asset_documents Users can delete assets in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete assets in their workspace" ON public.asset_documents FOR DELETE USING ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: campaign_assets Users can delete assets in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete assets in their workspace" ON public.campaign_assets FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: audiences Users can delete audiences in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete audiences in their workspace" ON public.audiences FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: brands Users can delete brands in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete brands in their workspace" ON public.brands FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: canvases Users can delete canvases in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete canvases in their workspace" ON public.canvases FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: campaign_claim_links Users can delete claim lineage in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete claim lineage in their workspace" ON public.campaign_claim_links FOR DELETE USING ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: content_ideas Users can delete content ideas in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete content ideas in their workspace" ON public.content_ideas FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: generated_images Users can delete images in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete images in their workspace" ON public.generated_images FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_items Users can delete knowledge in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete knowledge in their workspace" ON public.knowledge_items FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: newsletters Users can delete newsletters in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete newsletters in their workspace" ON public.newsletters FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = newsletters.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: private_chat_messages Users can delete own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own messages" ON public.private_chat_messages FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: project_pages Users can delete pages in their workspace projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete pages in their workspace projects" ON public.project_pages FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.projects p
     JOIN public.workspace_members wm ON ((wm.workspace_id = p.workspace_id)))
  WHERE ((p.id = project_pages.project_id) AND (wm.user_id = auth.uid())))));


--
-- Name: projects Users can delete projects in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete projects in their workspace" ON public.projects FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: published_pages Users can delete published pages in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete published pages in their workspace" ON public.published_pages FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = published_pages.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: share_tokens Users can delete share tokens in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete share tokens in their workspace" ON public.share_tokens FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: saved_ad_creatives Users can delete their ad creatives; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their ad creatives" ON public.saved_ad_creatives FOR DELETE USING ((created_by = auth.uid()));


--
-- Name: chat_sessions Users can delete their chat sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their chat sessions" ON public.chat_sessions FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: newsletter_templates Users can delete their newsletter templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their newsletter templates" ON public.newsletter_templates FOR DELETE USING ((created_by = auth.uid()));


--
-- Name: studio_apps Users can delete their own apps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own apps" ON public.studio_apps FOR DELETE USING ((created_by = auth.uid()));


--
-- Name: asset_comments Users can delete their own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own comments" ON public.asset_comments FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: snippets Users can delete their own snippets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own snippets" ON public.snippets FOR DELETE USING ((created_by = auth.uid()));


--
-- Name: saved_newsletters Users can delete their saved newsletters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their saved newsletters" ON public.saved_newsletters FOR DELETE USING ((created_by = auth.uid()));


--
-- Name: workflows Users can delete workflows in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete workflows in their workspace" ON public.workflows FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: ui_components Users can delete workspace components; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete workspace components" ON public.ui_components FOR DELETE USING (((workspace_id IS NOT NULL) AND (NOT is_system) AND (EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = ui_components.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));


--
-- Name: private_chat_messages Users can edit own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can edit own messages" ON public.private_chat_messages FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: ad_creatives Users can insert ad creatives in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert ad creatives in their workspace" ON public.ad_creatives FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = ad_creatives.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: asset_documents Users can insert assets in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert assets in their workspace" ON public.asset_documents FOR INSERT WITH CHECK ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: brain_snapshots Users can insert brain snapshots in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert brain snapshots in their workspace" ON public.brain_snapshots FOR INSERT WITH CHECK ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: brain_sources Users can insert brain sources in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert brain sources in their workspace" ON public.brain_sources FOR INSERT WITH CHECK ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: brain_sync_runs Users can insert brain sync runs in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert brain sync runs in their workspace" ON public.brain_sync_runs FOR INSERT WITH CHECK ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: brand_memory Users can insert brand memory in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert brand memory in their workspace" ON public.brand_memory FOR INSERT WITH CHECK ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: campaign_claim_links Users can insert claim lineage in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert claim lineage in their workspace" ON public.campaign_claim_links FOR INSERT WITH CHECK ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: legal_rules Users can insert legal rules in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert legal rules in their workspace" ON public.legal_rules FOR INSERT WITH CHECK ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: chat_messages Users can insert messages in their sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert messages in their sessions" ON public.chat_messages FOR INSERT WITH CHECK ((session_id IN ( SELECT chat_sessions.id
   FROM public.chat_sessions
  WHERE (chat_sessions.user_id = auth.uid()))));


--
-- Name: newsletters Users can insert newsletters in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert newsletters in their workspace" ON public.newsletters FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = newsletters.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: project_pages Users can insert pages in their workspace projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert pages in their workspace projects" ON public.project_pages FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.projects p
     JOIN public.workspace_members wm ON ((wm.workspace_id = p.workspace_id)))
  WHERE ((p.id = project_pages.project_id) AND (wm.user_id = auth.uid())))));


--
-- Name: product_facts Users can insert product facts in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert product facts in their workspace" ON public.product_facts FOR INSERT WITH CHECK ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: published_pages Users can insert published pages in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert published pages in their workspace" ON public.published_pages FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = published_pages.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: design_quality_events Users can insert quality events in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert quality events in their workspace" ON public.design_quality_events FOR INSERT WITH CHECK ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: asset_renders Users can insert renders in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert renders in their workspace" ON public.asset_renders FOR INSERT WITH CHECK ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: template_purchases Users can insert their template purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their template purchases" ON public.template_purchases FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: ad_ab_tests Users can manage ad ab tests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage ad ab tests" ON public.ad_ab_tests USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: automation_rules Users can manage automation rules in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage automation rules in their workspace" ON public.automation_rules USING ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: automation_runs Users can manage automation runs in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage automation runs in their workspace" ON public.automation_runs USING ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: battle_cards Users can manage battle cards in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage battle cards in their workspace" ON public.battle_cards USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: brand_assets Users can manage brand assets in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage brand assets in their workspace" ON public.brand_assets USING ((brand_id IN ( SELECT b.id
   FROM (public.brands b
     JOIN public.workspace_members wm ON ((wm.workspace_id = b.workspace_id)))
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: claim_performance Users can manage claim performance in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage claim performance in their workspace" ON public.claim_performance USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_collection_items Users can manage collection items in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage collection items in their workspace" ON public.knowledge_collection_items USING ((collection_id IN ( SELECT knowledge_collections.id
   FROM public.knowledge_collections
  WHERE (knowledge_collections.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: knowledge_collections Users can manage collections in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage collections in their workspace" ON public.knowledge_collections USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: competitors Users can manage competitors in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage competitors in their workspace" ON public.competitors USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: deployments Users can manage deployments for their campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage deployments for their campaigns" ON public.deployments USING ((EXISTS ( SELECT 1
   FROM (public.campaigns c
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((c.id = deployments.campaign_id) AND (wm.user_id = auth.uid())))));


--
-- Name: newsletter_ab_tests Users can manage newsletter ab tests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage newsletter ab tests" ON public.newsletter_ab_tests USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: user_saved_components Users can manage own saved components; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own saved components" ON public.user_saved_components USING ((user_id = auth.uid()));


--
-- Name: user_snippets Users can manage own saved snippets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own saved snippets" ON public.user_snippets USING ((user_id = auth.uid()));


--
-- Name: positioning_suggestions Users can manage positioning in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage positioning in their workspace" ON public.positioning_suggestions USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: video_scenes Users can manage scenes through parent script; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage scenes through parent script" ON public.video_scenes USING ((script_id IN ( SELECT vs.id
   FROM (public.video_scripts vs
     JOIN public.campaign_assets ca ON ((vs.asset_id = ca.id)))
  WHERE (ca.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: scheduled_content Users can manage scheduled content in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage scheduled content in their workspace" ON public.scheduled_content USING ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: video_scripts Users can manage scripts through parent asset; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage scripts through parent asset" ON public.video_scripts USING ((asset_id IN ( SELECT campaign_assets.id
   FROM public.campaign_assets
  WHERE (campaign_assets.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: deck_slides Users can manage slides through parent asset; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage slides through parent asset" ON public.deck_slides USING ((asset_id IN ( SELECT campaign_assets.id
   FROM public.campaign_assets
  WHERE (campaign_assets.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: social_post_variants Users can manage social variants through parent asset; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage social variants through parent asset" ON public.social_post_variants USING ((asset_id IN ( SELECT campaign_assets.id
   FROM public.campaign_assets
  WHERE (campaign_assets.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: campaign_targeting_rules Users can manage targeting rules in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage targeting rules in their workspace" ON public.campaign_targeting_rules USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: studio_app_favorites Users can manage their favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their favorites" ON public.studio_app_favorites USING ((user_id = auth.uid()));


--
-- Name: assembled_videos Users can manage videos through parent script; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage videos through parent script" ON public.assembled_videos USING ((script_id IN ( SELECT vs.id
   FROM (public.video_scripts vs
     JOIN public.campaign_assets ca ON ((vs.asset_id = ca.id)))
  WHERE (ca.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: voiceovers Users can manage voiceovers through parent script; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage voiceovers through parent script" ON public.voiceovers USING ((script_id IN ( SELECT vs.id
   FROM (public.video_scripts vs
     JOIN public.campaign_assets ca ON ((vs.asset_id = ca.id)))
  WHERE (ca.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: zapier_webhook_subscriptions Users can manage webhooks in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage webhooks in their workspace" ON public.zapier_webhook_subscriptions USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: project_assets Users can modify assets in their projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can modify assets in their projects" ON public.project_assets USING ((project_id IN ( SELECT projects.id
   FROM public.projects
  WHERE (projects.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: canvas_elements Users can modify elements in their canvases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can modify elements in their canvases" ON public.canvas_elements USING ((canvas_id IN ( SELECT canvases.id
   FROM public.canvases
  WHERE (canvases.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: gallery_interactions Users can record interactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can record interactions" ON public.gallery_interactions USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: snippet_favorites Users can remove their favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can remove their favorites" ON public.snippet_favorites FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: comment_reactions Users can remove their own reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can remove their own reactions" ON public.comment_reactions FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: public_campaigns Users can submit their campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can submit their campaigns" ON public.public_campaigns FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: ad_creatives Users can update ad creatives in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update ad creatives in their workspace" ON public.ad_creatives FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = ad_creatives.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: saved_ad_creatives Users can update ad creatives in workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update ad creatives in workspace" ON public.saved_ad_creatives FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: asset_documents Users can update assets in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update assets in their workspace" ON public.asset_documents FOR UPDATE USING ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: campaign_assets Users can update assets in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update assets in their workspace" ON public.campaign_assets FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: audiences Users can update audiences in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update audiences in their workspace" ON public.audiences FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: brain_snapshots Users can update brain snapshots in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update brain snapshots in their workspace" ON public.brain_snapshots FOR UPDATE USING ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: brain_sources Users can update brain sources in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update brain sources in their workspace" ON public.brain_sources FOR UPDATE USING ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: brain_sync_runs Users can update brain sync runs in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update brain sync runs in their workspace" ON public.brain_sync_runs FOR UPDATE USING ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: brand_memory Users can update brand memory in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update brand memory in their workspace" ON public.brand_memory FOR UPDATE USING ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: brands Users can update brands in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update brands in their workspace" ON public.brands FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: canvases Users can update canvases in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update canvases in their workspace" ON public.canvases FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: campaign_claim_links Users can update claim lineage in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update claim lineage in their workspace" ON public.campaign_claim_links FOR UPDATE USING ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: composer_documents Users can update composer documents in workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update composer documents in workspace" ON public.composer_documents FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: composer_sends Users can update composer sends in workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update composer sends in workspace" ON public.composer_sends FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: content_ideas Users can update content ideas in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update content ideas in their workspace" ON public.content_ideas FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: escalations Users can update escalations in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update escalations in their workspace" ON public.escalations FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: generated_images Users can update images in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update images in their workspace" ON public.generated_images FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_items Users can update knowledge in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update knowledge in their workspace" ON public.knowledge_items FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: legal_rules Users can update legal rules in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update legal rules in their workspace" ON public.legal_rules FOR UPDATE USING ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: newsletters Users can update newsletters in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update newsletters in their workspace" ON public.newsletters FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = newsletters.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: affiliates Users can update own affiliate; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own affiliate" ON public.affiliates FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: project_pages Users can update pages in their workspace projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update pages in their workspace projects" ON public.project_pages FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.projects p
     JOIN public.workspace_members wm ON ((wm.workspace_id = p.workspace_id)))
  WHERE ((p.id = project_pages.project_id) AND (wm.user_id = auth.uid())))));


--
-- Name: product_facts Users can update product facts in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update product facts in their workspace" ON public.product_facts FOR UPDATE USING ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: projects Users can update projects in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update projects in their workspace" ON public.projects FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: published_pages Users can update published pages in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update published pages in their workspace" ON public.published_pages FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = published_pages.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: workflow_runs Users can update runs in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update runs in their workspace" ON public.workflow_runs FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: saved_newsletters Users can update saved newsletters in workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update saved newsletters in workspace" ON public.saved_newsletters FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: share_tokens Users can update share tokens in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update share tokens in their workspace" ON public.share_tokens FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: sako_tasks Users can update tasks in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update tasks in their workspace" ON public.sako_tasks FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: chat_sessions Users can update their chat sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their chat sessions" ON public.chat_sessions FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: newsletter_templates Users can update their newsletter templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their newsletter templates" ON public.newsletter_templates FOR UPDATE USING ((created_by = auth.uid()));


--
-- Name: studio_apps Users can update their own apps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own apps" ON public.studio_apps FOR UPDATE USING ((created_by = auth.uid()));


--
-- Name: asset_comments Users can update their own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own comments" ON public.asset_comments FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: comment_notifications Users can update their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notifications" ON public.comment_notifications FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: canvas_presence Users can update their own presence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own presence" ON public.canvas_presence USING ((user_id = auth.uid()));


--
-- Name: template_reviews Users can update their own reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own reviews" ON public.template_reviews FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: snippets Users can update their own snippets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own snippets" ON public.snippets FOR UPDATE USING ((created_by = auth.uid()));


--
-- Name: public_campaigns Users can update their submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their submissions" ON public.public_campaigns FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workflows Users can update workflows in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update workflows in their workspace" ON public.workflows FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: ui_components Users can update workspace components; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update workspace components" ON public.ui_components FOR UPDATE USING (((workspace_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = ui_components.workspace_id) AND (wm.user_id = auth.uid()))))));


--
-- Name: sako_task_activity Users can view activity for their tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view activity for their tasks" ON public.sako_task_activity FOR SELECT USING ((task_id IN ( SELECT sako_tasks.id
   FROM public.sako_tasks
  WHERE (sako_tasks.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: ad_ab_tests Users can view ad ab tests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view ad ab tests" ON public.ad_ab_tests FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: ad_creative_versions Users can view ad creative versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view ad creative versions" ON public.ad_creative_versions FOR SELECT USING ((creative_id IN ( SELECT saved_ad_creatives.id
   FROM public.saved_ad_creatives
  WHERE (saved_ad_creatives.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: ad_creatives Users can view ad creatives in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view ad creatives in their workspace" ON public.ad_creatives FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = ad_creatives.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: saved_ad_creatives Users can view ad creatives in workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view ad creatives in workspace" ON public.saved_ad_creatives FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: ad_format_configs Users can view ad format configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view ad format configs" ON public.ad_format_configs FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: budget_alert_history Users can view alert history in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view alert history in their workspace" ON public.budget_alert_history FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: share_views Users can view analytics for their share tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view analytics for their share tokens" ON public.share_views FOR SELECT USING ((share_token_id IN ( SELECT share_tokens.id
   FROM public.share_tokens
  WHERE (share_tokens.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: approval_instances Users can view approval instances in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view approval instances in their workspace" ON public.approval_instances FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: approval_templates Users can view approval templates in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view approval templates in their workspace" ON public.approval_templates FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: project_assets Users can view assets in their projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view assets in their projects" ON public.project_assets FOR SELECT USING ((project_id IN ( SELECT projects.id
   FROM public.projects
  WHERE (projects.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: asset_documents Users can view assets in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view assets in their workspace" ON public.asset_documents FOR SELECT USING ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: campaign_assets Users can view assets in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view assets in their workspace" ON public.campaign_assets FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: audiences Users can view audiences in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view audiences in their workspace" ON public.audiences FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: battle_cards Users can view battle cards in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view battle cards in their workspace" ON public.battle_cards FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: bigquery_sync_configs Users can view bigquery configs in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view bigquery configs in their workspace" ON public.bigquery_sync_configs FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: bigquery_sync_history Users can view bigquery sync history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view bigquery sync history" ON public.bigquery_sync_history FOR SELECT USING ((sync_config_id IN ( SELECT bigquery_sync_configs.id
   FROM public.bigquery_sync_configs
  WHERE (bigquery_sync_configs.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: brain_learning_runs Users can view brain learning runs in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view brain learning runs in their workspace" ON public.brain_learning_runs FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: brain_snapshots Users can view brain snapshots in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view brain snapshots in their workspace" ON public.brain_snapshots FOR SELECT USING ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: brain_sources Users can view brain sources in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view brain sources in their workspace" ON public.brain_sources FOR SELECT USING ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: brain_sync_runs Users can view brain sync runs in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view brain sync runs in their workspace" ON public.brain_sync_runs FOR SELECT USING ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: brand_memory Users can view brand memory in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view brand memory in their workspace" ON public.brand_memory FOR SELECT USING ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: brands Users can view brands in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view brands in their workspace" ON public.brands FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: budget_alerts Users can view budget alerts in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view budget alerts in their workspace" ON public.budget_alerts FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: campaign_fact_citations Users can view campaign fact citations in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view campaign fact citations in their workspace" ON public.campaign_fact_citations FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: canvases Users can view canvases in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view canvases in their workspace" ON public.canvases FOR SELECT USING (((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))) OR (is_public = true)));


--
-- Name: campaign_claim_links Users can view claim lineage in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view claim lineage in their workspace" ON public.campaign_claim_links FOR SELECT USING ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: claim_performance Users can view claim performance in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view claim performance in their workspace" ON public.claim_performance FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: canvas_comments Users can view comments in accessible canvases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view comments in accessible canvases" ON public.canvas_comments FOR SELECT USING ((canvas_id IN ( SELECT canvases.id
   FROM public.canvases
  WHERE ((canvases.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))) OR (canvases.is_public = true)))));


--
-- Name: asset_comments Users can view comments in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view comments in their workspace" ON public.asset_comments FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: competitors Users can view competitors in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view competitors in their workspace" ON public.competitors FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: ui_components Users can view components; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view components" ON public.ui_components FOR SELECT USING (((is_public = true) OR (is_system = true) OR (workspace_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = ui_components.workspace_id) AND (wm.user_id = auth.uid()))))));


--
-- Name: composer_document_versions Users can view composer document versions in workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view composer document versions in workspace" ON public.composer_document_versions FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: composer_documents Users can view composer documents in workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view composer documents in workspace" ON public.composer_documents FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: composer_sends Users can view composer sends in workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view composer sends in workspace" ON public.composer_sends FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: hubspot_contacts Users can view contacts in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view contacts in their workspace" ON public.hubspot_contacts FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: content_ideas Users can view content ideas in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view content ideas in their workspace" ON public.content_ideas FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: approval_decisions Users can view decisions for instances in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view decisions for instances in their workspace" ON public.approval_decisions FOR SELECT USING ((instance_id IN ( SELECT approval_instances.id
   FROM public.approval_instances
  WHERE (approval_instances.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: zapier_webhook_deliveries Users can view deliveries for their webhooks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view deliveries for their webhooks" ON public.zapier_webhook_deliveries FOR SELECT USING ((subscription_id IN ( SELECT zapier_webhook_subscriptions.id
   FROM public.zapier_webhook_subscriptions
  WHERE (zapier_webhook_subscriptions.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: deployments Users can view deployments for their campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view deployments for their campaigns" ON public.deployments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.campaigns c
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((c.id = deployments.campaign_id) AND (wm.user_id = auth.uid())))));


--
-- Name: canvas_elements Users can view elements in accessible canvases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view elements in accessible canvases" ON public.canvas_elements FOR SELECT USING ((canvas_id IN ( SELECT canvases.id
   FROM public.canvases
  WHERE ((canvases.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))) OR (canvases.is_public = true)))));


--
-- Name: escalations Users can view escalations in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view escalations in their workspace" ON public.escalations FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: composer_feedback_events Users can view feedback in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view feedback in their workspace" ON public.composer_feedback_events FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: cost_forecasts Users can view forecasts in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view forecasts in their workspace" ON public.cost_forecasts FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: provider_health_checks Users can view health checks in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view health checks in their workspace" ON public.provider_health_checks FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: provider_health_summary Users can view health summary in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view health summary in their workspace" ON public.provider_health_summary FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: generated_images Users can view images in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view images in their workspace" ON public.generated_images FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: provider_incidents Users can view incidents in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view incidents in their workspace" ON public.provider_incidents FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_items Users can view knowledge in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view knowledge in their workspace" ON public.knowledge_items FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: legal_rules Users can view legal rules in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view legal rules in their workspace" ON public.legal_rules FOR SELECT USING ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: hubspot_lists Users can view lists in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view lists in their workspace" ON public.hubspot_lists FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: project_members Users can view members in their projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view members in their projects" ON public.project_members FOR SELECT USING ((project_id IN ( SELECT projects.id
   FROM public.projects
  WHERE (projects.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: chat_messages Users can view messages in their sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view messages in their sessions" ON public.chat_messages FOR SELECT USING ((session_id IN ( SELECT chat_sessions.id
   FROM public.chat_sessions
  WHERE (chat_sessions.user_id = auth.uid()))));


--
-- Name: newsletter_ab_tests Users can view newsletter ab tests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view newsletter ab tests" ON public.newsletter_ab_tests FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: newsletter_templates Users can view newsletter templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view newsletter templates" ON public.newsletter_templates FOR SELECT USING (((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))) OR (is_public = true)));


--
-- Name: newsletters Users can view newsletters in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view newsletters in their workspace" ON public.newsletters FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = newsletters.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: workflow_node_executions Users can view node executions for their runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view node executions for their runs" ON public.workflow_node_executions FOR SELECT USING ((run_id IN ( SELECT workflow_runs.id
   FROM public.workflow_runs
  WHERE (workflow_runs.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: affiliates Users can view own affiliate; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own affiliate" ON public.affiliates FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: workspace_members Users can view own memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own memberships" ON public.workspace_members FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: page_view_events Users can view page events for their published pages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view page events for their published pages" ON public.page_view_events FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.published_pages pp
     JOIN public.workspace_members wm ON ((wm.workspace_id = pp.workspace_id)))
  WHERE ((pp.id = page_view_events.published_page_id) AND (wm.user_id = auth.uid())))));


--
-- Name: project_pages Users can view pages in their workspace projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view pages in their workspace projects" ON public.project_pages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.projects p
     JOIN public.workspace_members wm ON ((wm.workspace_id = p.workspace_id)))
  WHERE ((p.id = project_pages.project_id) AND (wm.user_id = auth.uid())))));


--
-- Name: performance Users can view performance for their campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view performance for their campaigns" ON public.performance FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.campaigns c
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((c.id = performance.campaign_id) AND (wm.user_id = auth.uid())))));


--
-- Name: positioning_suggestions Users can view positioning in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view positioning in their workspace" ON public.positioning_suggestions FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: canvas_presence Users can view presence in accessible canvases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view presence in accessible canvases" ON public.canvas_presence FOR SELECT USING ((canvas_id IN ( SELECT canvases.id
   FROM public.canvases
  WHERE ((canvases.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))) OR (canvases.is_public = true)))));


--
-- Name: product_facts Users can view product facts in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view product facts in their workspace" ON public.product_facts FOR SELECT USING ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: projects Users can view projects in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view projects in their workspace" ON public.projects FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: published_pages Users can view published pages in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view published pages in their workspace" ON public.published_pages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = published_pages.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: design_quality_events Users can view quality events in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view quality events in their workspace" ON public.design_quality_events FOR SELECT USING ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: comment_reactions Users can view reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view reactions" ON public.comment_reactions FOR SELECT USING ((comment_id IN ( SELECT asset_comments.id
   FROM public.asset_comments
  WHERE (asset_comments.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: asset_renders Users can view renders in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view renders in their workspace" ON public.asset_renders FOR SELECT USING ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: studio_app_runs Users can view runs for accessible apps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view runs for accessible apps" ON public.studio_app_runs FOR SELECT USING ((app_id IN ( SELECT studio_apps.id
   FROM public.studio_apps
  WHERE ((studio_apps.created_by = auth.uid()) OR ((studio_apps.visibility = 'workspace'::text) AND (studio_apps.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))))));


--
-- Name: workflow_runs Users can view runs in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view runs in their workspace" ON public.workflow_runs FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: saved_newsletters Users can view saved newsletters in workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view saved newsletters in workspace" ON public.saved_newsletters FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: share_tokens Users can view share tokens in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view share tokens in their workspace" ON public.share_tokens FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: composer_snapshots Users can view snapshots in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view snapshots in their workspace" ON public.composer_snapshots FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: snippets Users can view snippets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view snippets" ON public.snippets FOR SELECT USING (((is_public = true) OR (workspace_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = snippets.workspace_id) AND (wm.user_id = auth.uid()))))));


--
-- Name: hubspot_sync_jobs Users can view sync jobs in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view sync jobs in their workspace" ON public.hubspot_sync_jobs FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_composer_snapshots Users can view task composer snapshots in workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view task composer snapshots in workspace" ON public.task_composer_snapshots FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: sako_tasks Users can view tasks in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view tasks in their workspace" ON public.sako_tasks FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: template_acquisitions Users can view their acquisitions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their acquisitions" ON public.template_acquisitions FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: chat_sessions Users can view their chat sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their chat sessions" ON public.chat_sessions FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: snippet_favorites Users can view their favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their favorites" ON public.snippet_favorites FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: studio_apps Users can view their own apps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own apps" ON public.studio_apps FOR SELECT USING (((created_by = auth.uid()) OR ((visibility = 'workspace'::text) AND (workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))) OR (visibility = 'public'::text)));


--
-- Name: comment_notifications Users can view their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notifications" ON public.comment_notifications FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: template_purchases Users can view their own purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own purchases" ON public.template_purchases FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: private_chats Users can view their private chats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their private chats" ON public.private_chats FOR SELECT USING (((auth.uid() = ANY (participants)) OR (auth.uid() = created_by) OR (EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = private_chats.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));


--
-- Name: template_purchases Users can view their template purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their template purchases" ON public.template_purchases FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: canvas_versions Users can view versions in their canvases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view versions in their canvases" ON public.canvas_versions FOR SELECT USING ((canvas_id IN ( SELECT canvases.id
   FROM public.canvases
  WHERE (canvases.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: webhook_configurations Users can view webhook configs in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view webhook configs in their workspace" ON public.webhook_configurations FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: webhook_deliveries Users can view webhook delivery logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view webhook delivery logs" ON public.webhook_deliveries FOR SELECT USING ((webhook_id IN ( SELECT webhook_configurations.id
   FROM public.webhook_configurations
  WHERE (webhook_configurations.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: workflows Users can view workflows in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view workflows in their workspace" ON public.workflows FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: snippets Users can view workspace or public snippets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view workspace or public snippets" ON public.snippets FOR SELECT USING (((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))) OR (is_public = true)));


--
-- Name: social_calendars Workspace admins can delete calendars; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace admins can delete calendars" ON public.social_calendars FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = social_calendars.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: website_designs Workspace admins can delete designs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace admins can delete designs" ON public.website_designs FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = website_designs.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: social_posts Workspace admins can delete posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace admins can delete posts" ON public.social_posts FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = social_posts.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: api_keys Workspace admins can manage API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace admins can manage API keys" ON public.api_keys USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = api_keys.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.role = 'admin'::text)))));


--
-- Name: provider_connections Workspace admins can manage provider connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace admins can manage provider connections" ON public.provider_connections USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = provider_connections.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.role = 'admin'::text)))));


--
-- Name: social_calendars Workspace members can create calendars; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can create calendars" ON public.social_calendars FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = social_calendars.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: claims Workspace members can create claims; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can create claims" ON public.claims FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = claims.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: website_designs Workspace members can create designs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can create designs" ON public.website_designs FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = website_designs.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: social_posts Workspace members can create posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can create posts" ON public.social_posts FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = social_posts.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: snippets Workspace members can create snippets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can create snippets" ON public.snippets FOR INSERT WITH CHECK (((workspace_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = snippets.workspace_id) AND (wm.user_id = auth.uid()))))));


--
-- Name: claim_packs Workspace members can manage claim packs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can manage claim packs" ON public.claim_packs USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = claim_packs.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: claim_evidence_links Workspace members can manage evidence links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can manage evidence links" ON public.claim_evidence_links USING ((EXISTS ( SELECT 1
   FROM (public.claims c
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((c.id = claim_evidence_links.claim_id) AND (wm.user_id = auth.uid())))));


--
-- Name: website_pages Workspace members can manage pages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can manage pages" ON public.website_pages USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = website_pages.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: published_sites Workspace members can manage published sites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can manage published sites" ON public.published_sites USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text]))))));


--
-- Name: social_calendars Workspace members can update calendars; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can update calendars" ON public.social_calendars FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = social_calendars.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: website_designs Workspace members can update designs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can update designs" ON public.website_designs FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = website_designs.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: claims Workspace members can update own claims; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can update own claims" ON public.claims FOR UPDATE USING (((created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = claims.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['admin'::text, 'reviewer'::text])))))));


--
-- Name: social_posts Workspace members can update posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can update posts" ON public.social_posts FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = social_posts.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: audit_log Workspace members can view audit log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can view audit log" ON public.audit_log FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = audit_log.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: social_calendars Workspace members can view calendars; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can view calendars" ON public.social_calendars FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = social_calendars.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: claim_performance Workspace members can view claim performance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can view claim performance" ON public.claim_performance FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = claim_performance.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: claims Workspace members can view claims; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can view claims" ON public.claims FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = claims.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: website_designs Workspace members can view designs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can view designs" ON public.website_designs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = website_designs.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: api_keys Workspace members can view own API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can view own API keys" ON public.api_keys FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = api_keys.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: provider_connections Workspace members can view own provider connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can view own provider connections" ON public.provider_connections FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = provider_connections.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: policies Workspace members can view policies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can view policies" ON public.policies FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = policies.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: social_posts Workspace members can view posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can view posts" ON public.social_posts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = social_posts.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: published_sites Workspace members can view published sites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can view published sites" ON public.published_sites FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: subscriptions Workspace members can view subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can view subscriptions" ON public.subscriptions FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: ai_traces Workspace members can view traces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can view traces" ON public.ai_traces FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: subscriptions Workspace owners can manage subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace owners can manage subscriptions" ON public.subscriptions USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = 'owner'::text)))));


--
-- Name: cancellation_feedback Workspace owners can submit cancellation feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace owners can submit cancellation feedback" ON public.cancellation_feedback FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = 'owner'::text)))));


--
-- Name: ad_ab_tests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ad_ab_tests ENABLE ROW LEVEL SECURITY;

--
-- Name: ad_creative_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ad_creative_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: ad_creatives; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ad_creatives ENABLE ROW LEVEL SECURITY;

--
-- Name: ad_format_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ad_format_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_commissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_payouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_referrals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_runs agent_runs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_runs_select ON public.agent_runs FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: ai_traces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_traces ENABLE ROW LEVEL SECURITY;

--
-- Name: experiment_events anyone_insert_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anyone_insert_events ON public.experiment_events FOR INSERT WITH CHECK (true);


--
-- Name: api_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_decisions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_decisions ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_instances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_instances ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_requests approval_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY approval_select ON public.approval_requests FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: approval_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_requests approval_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY approval_update ON public.approval_requests FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: approvals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

--
-- Name: assembled_videos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assembled_videos ENABLE ROW LEVEL SECURITY;

--
-- Name: asset_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asset_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: asset_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asset_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: asset_renders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asset_renders ENABLE ROW LEVEL SECURITY;

--
-- Name: audiences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audiences ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: section_analytics authenticated_read_analytics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_analytics ON public.section_analytics FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: learned_sections authenticated_read_learned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_learned ON public.learned_sections FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: design_templates authenticated_users_can_read_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_users_can_read_templates ON public.design_templates FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: automation_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: battle_cards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.battle_cards ENABLE ROW LEVEL SECURITY;

--
-- Name: bigquery_sync_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bigquery_sync_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: bigquery_sync_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bigquery_sync_history ENABLE ROW LEVEL SECURITY;

--
-- Name: brain_learning_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brain_learning_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: brain_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brain_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: brain_sources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brain_sources ENABLE ROW LEVEL SECURITY;

--
-- Name: brain_sync_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brain_sync_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: brand_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: brand_memory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brand_memory ENABLE ROW LEVEL SECURITY;

--
-- Name: brands; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

--
-- Name: budget_alert_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.budget_alert_history ENABLE ROW LEVEL SECURITY;

--
-- Name: budget_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.budget_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_claim_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_claim_links ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_fact_citations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_fact_citations ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_targeting_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_targeting_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: cancellation_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cancellation_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: canvas_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.canvas_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: canvas_elements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.canvas_elements ENABLE ROW LEVEL SECURITY;

--
-- Name: canvas_presence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.canvas_presence ENABLE ROW LEVEL SECURITY;

--
-- Name: canvas_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.canvas_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: canvases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.canvases ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: claim_evidence_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.claim_evidence_links ENABLE ROW LEVEL SECURITY;

--
-- Name: claim_packs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.claim_packs ENABLE ROW LEVEL SECURITY;

--
-- Name: claim_performance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.claim_performance ENABLE ROW LEVEL SECURITY;

--
-- Name: claims; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

--
-- Name: comment_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comment_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: comment_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: competitors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_reports compliance_reports_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_reports_public_read ON public.compliance_reports FOR SELECT USING (((is_public = true) AND (expires_at > now())));


--
-- Name: compliance_reports compliance_reports_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_reports_service ON public.compliance_reports USING ((auth.role() = 'service_role'::text));


--
-- Name: composer_document_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.composer_document_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: composer_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.composer_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: composer_feedback_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.composer_feedback_events ENABLE ROW LEVEL SECURITY;

--
-- Name: composer_sends; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.composer_sends ENABLE ROW LEVEL SECURITY;

--
-- Name: composer_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.composer_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: content_ideas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_ideas ENABLE ROW LEVEL SECURITY;

--
-- Name: cost_forecasts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cost_forecasts ENABLE ROW LEVEL SECURITY;

--
-- Name: creator_earnings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.creator_earnings ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: deck_slides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deck_slides ENABLE ROW LEVEL SECURITY;

--
-- Name: deployments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;

--
-- Name: design_quality_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.design_quality_events ENABLE ROW LEVEL SECURITY;

--
-- Name: design_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.design_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: escalations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;

--
-- Name: experiment_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.experiment_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: experiment_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.experiment_events ENABLE ROW LEVEL SECURITY;

--
-- Name: experiment_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.experiment_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: experiment_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.experiment_results ENABLE ROW LEVEL SECURITY;

--
-- Name: experiment_variants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.experiment_variants ENABLE ROW LEVEL SECURITY;

--
-- Name: experiments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;

--
-- Name: gallery_collection_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gallery_collection_items ENABLE ROW LEVEL SECURITY;

--
-- Name: gallery_collections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gallery_collections ENABLE ROW LEVEL SECURITY;

--
-- Name: gallery_interactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gallery_interactions ENABLE ROW LEVEL SECURITY;

--
-- Name: generated_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;

--
-- Name: generations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

--
-- Name: hubspot_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hubspot_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: hubspot_lists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hubspot_lists ENABLE ROW LEVEL SECURITY;

--
-- Name: hubspot_sync_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hubspot_sync_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: kit_deployments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kit_deployments ENABLE ROW LEVEL SECURITY;

--
-- Name: kit_deployments kit_deployments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kit_deployments_insert ON public.kit_deployments FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: kit_deployments kit_deployments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kit_deployments_select ON public.kit_deployments FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: kit_deployments kit_deployments_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kit_deployments_service ON public.kit_deployments USING ((auth.role() = 'service_role'::text));


--
-- Name: knowledge_collection_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_collection_items ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_collections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_collections ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_items ENABLE ROW LEVEL SECURITY;

--
-- Name: launch_kits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.launch_kits ENABLE ROW LEVEL SECURITY;

--
-- Name: launch_kits launch_kits_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY launch_kits_delete ON public.launch_kits FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: launch_kits launch_kits_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY launch_kits_insert ON public.launch_kits FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: launch_kits launch_kits_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY launch_kits_select ON public.launch_kits FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: launch_kits launch_kits_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY launch_kits_service ON public.launch_kits USING ((auth.role() = 'service_role'::text));


--
-- Name: launch_kits launch_kits_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY launch_kits_update ON public.launch_kits FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: learned_sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learned_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: legal_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.legal_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: marketplace_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketplace_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: memory_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.memory_items ENABLE ROW LEVEL SECURITY;

--
-- Name: memory_items memory_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY memory_items_insert ON public.memory_items FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: memory_items memory_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY memory_items_select ON public.memory_items FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: memory_items memory_items_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY memory_items_service ON public.memory_items USING ((auth.role() = 'service_role'::text));


--
-- Name: memory_items memory_items_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY memory_items_update ON public.memory_items FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: newsletter_ab_tests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.newsletter_ab_tests ENABLE ROW LEVEL SECURITY;

--
-- Name: newsletter_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.newsletter_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: newsletters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;

--
-- Name: design_templates only_service_role_can_modify_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY only_service_role_can_modify_templates ON public.design_templates USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: page_view_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.page_view_events ENABLE ROW LEVEL SECURITY;

--
-- Name: performance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.performance ENABLE ROW LEVEL SECURITY;

--
-- Name: policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

--
-- Name: positioning_suggestions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.positioning_suggestions ENABLE ROW LEVEL SECURITY;

--
-- Name: private_chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.private_chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: private_chats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.private_chats ENABLE ROW LEVEL SECURITY;

--
-- Name: product_facts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_facts ENABLE ROW LEVEL SECURITY;

--
-- Name: project_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: project_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

--
-- Name: project_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: provider_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.provider_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: provider_health_checks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.provider_health_checks ENABLE ROW LEVEL SECURITY;

--
-- Name: provider_health_summary; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.provider_health_summary ENABLE ROW LEVEL SECURITY;

--
-- Name: provider_incidents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.provider_incidents ENABLE ROW LEVEL SECURITY;

--
-- Name: public_campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.public_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: published_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.published_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: published_pages published_pages_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY published_pages_insert ON public.published_pages FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: published_pages published_pages_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY published_pages_service ON public.published_pages USING ((auth.role() = 'service_role'::text));


--
-- Name: published_pages published_pages_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY published_pages_update ON public.published_pages FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: published_sites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.published_sites ENABLE ROW LEVEL SECURITY;

--
-- Name: requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

--
-- Name: requests requests_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY requests_delete ON public.requests FOR DELETE USING (((requester_id = auth.uid()) OR (assignee_id = auth.uid()) OR (workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = ANY (ARRAY['admin'::text, 'owner'::text])))))));


--
-- Name: requests requests_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY requests_insert ON public.requests FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: requests requests_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY requests_select ON public.requests FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: requests requests_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY requests_service ON public.requests USING ((auth.role() = 'service_role'::text));


--
-- Name: requests requests_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY requests_update ON public.requests FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: sako_task_activity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sako_task_activity ENABLE ROW LEVEL SECURITY;

--
-- Name: sako_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sako_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: saved_ad_creatives; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.saved_ad_creatives ENABLE ROW LEVEL SECURITY;

--
-- Name: saved_newsletters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.saved_newsletters ENABLE ROW LEVEL SECURITY;

--
-- Name: scheduled_content; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scheduled_content ENABLE ROW LEVEL SECURITY;

--
-- Name: section_analytics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.section_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: share_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.share_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: share_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

--
-- Name: share_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.share_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: share_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.share_views ENABLE ROW LEVEL SECURITY;

--
-- Name: snippet_favorites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.snippet_favorites ENABLE ROW LEVEL SECURITY;

--
-- Name: snippets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.snippets ENABLE ROW LEVEL SECURITY;

--
-- Name: social_calendars; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.social_calendars ENABLE ROW LEVEL SECURITY;

--
-- Name: social_post_variants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.social_post_variants ENABLE ROW LEVEL SECURITY;

--
-- Name: social_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_configurations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sso_configurations ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_app_favorites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.studio_app_favorites ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_app_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.studio_app_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_apps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.studio_apps ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: task_composer_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_composer_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: team_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: team_sessions team_sessions_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_sessions_delete ON public.team_sessions FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: team_sessions team_sessions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_sessions_insert ON public.team_sessions FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: team_sessions team_sessions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_sessions_select ON public.team_sessions FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: team_sessions team_sessions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_sessions_update ON public.team_sessions FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: template_acquisitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.template_acquisitions ENABLE ROW LEVEL SECURITY;

--
-- Name: template_purchases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.template_purchases ENABLE ROW LEVEL SECURITY;

--
-- Name: template_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.template_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

--
-- Name: ui_components; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ui_components ENABLE ROW LEVEL SECURITY;

--
-- Name: usage_aggregates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usage_aggregates ENABLE ROW LEVEL SECURITY;

--
-- Name: usage_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

--
-- Name: usage_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: user_saved_components; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_saved_components ENABLE ROW LEVEL SECURITY;

--
-- Name: user_snippets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_snippets ENABLE ROW LEVEL SECURITY;

--
-- Name: video_scenes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.video_scenes ENABLE ROW LEVEL SECURITY;

--
-- Name: video_scripts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.video_scripts ENABLE ROW LEVEL SECURITY;

--
-- Name: voiceovers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.voiceovers ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_wallets wallet_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wallet_select ON public.workspace_wallets FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: wallet_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: wallet_transactions wallet_transactions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wallet_transactions_select ON public.wallet_transactions FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: webhook_configurations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhook_configurations ENABLE ROW LEVEL SECURITY;

--
-- Name: webhook_deliveries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

--
-- Name: website_designs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.website_designs ENABLE ROW LEVEL SECURITY;

--
-- Name: website_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.website_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_node_executions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_node_executions ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: workflows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions workspace_admins_can_manage_billing; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_admins_can_manage_billing ON public.subscriptions USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = subscriptions.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.role = 'admin'::text)))));


--
-- Name: workspace_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_assets workspace_members_can_manage_assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_members_can_manage_assets ON public.campaign_assets USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = campaign_assets.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: usage_metrics workspace_members_can_view_usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_members_can_view_usage ON public.usage_metrics FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = usage_metrics.workspace_id) AND (wm.user_id = auth.uid())))));


--
-- Name: workspace_wallets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_wallets ENABLE ROW LEVEL SECURITY;

--
-- Name: zapier_api_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.zapier_api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: zapier_webhook_deliveries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.zapier_webhook_deliveries ENABLE ROW LEVEL SECURITY;

--
-- Name: zapier_webhook_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.zapier_webhook_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict wtYXtnA51lFNQ8cKxpvYlWr4aoVsIWbhQsZFiXQUdGkYcRZZPaphom7vJec9saw

