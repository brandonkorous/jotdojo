-- Per-space billing. ADR-038.
--
-- The subscription lives beside the space rather than beside the user, because
-- what is bought is a SPACE's plan: a family pays once and four people benefit,
-- and the person who happened to enter a card is not the thing being billed.
--
-- `spaces.plan` stays the single source of truth for what a space is ALLOWED
-- (app_plan_allowance reads it, 0015). This table records why -- who the
-- provider thinks the customer is, and until when. Splitting entitlement from
-- its paperwork means a provider outage cannot silently downgrade anyone.

CREATE TABLE space_billing (
  space_id             uuid PRIMARY KEY REFERENCES spaces(id) ON DELETE CASCADE,
  provider             text NOT NULL,
  customer_id          text NOT NULL,
  subscription_id      text,
  status               text NOT NULL DEFAULT 'canceled'
    CHECK (status IN ('active','trialing','past_due','canceled')),
  plan                 text NOT NULL DEFAULT 'free',
  current_period_end   timestamptz,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX space_billing_customer_idx ON space_billing (provider, customer_id);

ALTER TABLE space_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_billing FORCE  ROW LEVEL SECURITY;

-- Owners see the billing state; members do not. What a space is ALLOWED is
-- visible to everyone (app_space_usage), because that explains why a transcript
-- has not appeared. Who paid, and when it renews, is the owner's business.
CREATE POLICY space_billing_read ON space_billing FOR SELECT
  USING (app_is_space_owner(space_id));

GRANT SELECT ON space_billing TO jotdojo_app;

-- ------------------------------------------------------------- the door ----
--
-- Applying a webhook has no actor: it arrives from the payment provider, not
-- from a signed-in person, so it cannot satisfy any policy. Same shape as
-- sign-in and invite acceptance -- one narrow function rather than a write
-- grant on `spaces`.
--
-- THE CALLER MUST HAVE VERIFIED THE SIGNATURE. This function is the last step
-- of a verified webhook, never a public entry point; that is why it is not
-- granted to anything that takes user input directly.

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
  IF p_plan NOT IN ('family','team') THEN
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
  -- take a family's recognition away mid-month; the provider retries for days
  -- before giving up, and 'canceled' is what arrives if it truly ends.
  v_entitled := CASE
    WHEN p_status IN ('active','trialing','past_due') THEN p_plan
    ELSE 'free'
  END;

  UPDATE spaces SET plan = v_entitled WHERE id = p_space_id;
END;
$$;

CREATE OR REPLACE FUNCTION app_cancel_subscription(p_space_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE space_billing
     SET status = 'canceled', plan = 'free', updated_at = now()
   WHERE space_id = p_space_id;
  -- Down to free, never below it. Notes are never deleted for non-payment;
  -- recognition simply defers again (ADR-007, ADR-036).
  UPDATE spaces SET plan = 'free' WHERE id = p_space_id;
END;
$$;

REVOKE ALL ON FUNCTION app_apply_subscription(uuid, text, text, text, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_cancel_subscription(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_apply_subscription(uuid, text, text, text, text, text, timestamptz) TO jotdojo_app;
GRANT EXECUTE ON FUNCTION app_cancel_subscription(uuid) TO jotdojo_app;
