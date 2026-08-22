-- The Solo plan. docs/01-audience-and-pricing.md.
--
-- The pricing doc has always listed four plans and the schema only ever knew
-- three, so a single person who wanted full MCP had to buy Family. Found while
-- building the marketing site: a pricing page can only honestly sell what
-- app_apply_subscription will accept.
--
-- 1000 units sits where the ladder implies. Family is 2000 pooled across up to
-- six people and free is 100, so one paying person landing between them is the
-- only number that keeps "Family is Solo, pooled" true.

CREATE OR REPLACE FUNCTION app_plan_allowance(p_plan text) RETURNS integer
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_plan
    WHEN 'solo'   THEN 1000
    WHEN 'family' THEN 2000
    WHEN 'team'   THEN 10000
    WHEN 'anon'   THEN 0
    ELSE 100
  END
$$;

CREATE OR REPLACE FUNCTION app_apply_subscription(
  p_space_id        uuid,
  p_provider        text,
  p_customer_id     text,
  p_subscription_id text,
  p_status          text,
  p_plan            text,
  p_period_end      timestamptz
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entitled text;
BEGIN
  IF p_plan NOT IN ('solo','family','team') THEN
    RAISE EXCEPTION 'not a sellable plan: %', p_plan USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO space_billing (
    space_id, provider, customer_id, subscription_id, status, plan,
    current_period_end, updated_at)
  VALUES (
    p_space_id, p_provider, p_customer_id, p_subscription_id, p_status, p_plan,
    p_period_end, now())
  ON CONFLICT (space_id) DO UPDATE
    SET provider = EXCLUDED.provider,
        customer_id = EXCLUDED.customer_id,
        subscription_id = EXCLUDED.subscription_id,
        status = EXCLUDED.status,
        plan = EXCLUDED.plan,
        current_period_end = EXCLUDED.current_period_end,
        updated_at = now();

  -- PAST DUE KEEPS THE PLAN. A failed card is a conversation, not a reason to
  -- take a family's recognition away mid-month.
  v_entitled := CASE
    WHEN p_status IN ('active','trialing','past_due') THEN p_plan
    ELSE 'free'
  END;

  UPDATE spaces SET plan = v_entitled WHERE id = p_space_id;
END;
$$;
