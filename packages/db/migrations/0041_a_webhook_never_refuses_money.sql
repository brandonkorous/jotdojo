-- A webhook never refuses money that has already been taken. Issue 051.
--
-- 0040 made `app_apply_subscription` RAISE when the space already rode on
-- another space's plan. That is the correct answer at the checkout button and
-- the wrong one here, and the difference is which side of the card it sits on:
-- by the time a webhook arrives the customer has paid. Refusing it means the
-- charge stands and nothing is recorded, which is the one failure ADR-038
-- splits entitlement from paperwork to avoid.
--
-- So a subscription arriving for a space MEANS that space pays for itself now.
-- It detaches and the subscription applies. The guard that matters is still
-- there, in `startCheckout` and in the account screen, BEFORE a card is asked
-- for -- and `smoke-seats` found this by paying for two spaces in a row.

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

  -- Paying for a space is what makes it pay for itself. Its own row below is
  -- the subscription it no longer needs anybody else's for.
  UPDATE spaces SET billed_with = NULL
   WHERE id = p_space_id AND billed_with IS NOT NULL;

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

  UPDATE spaces SET plan = v_entitled
   WHERE id = p_space_id OR billed_with = p_space_id;
END;
$$;
