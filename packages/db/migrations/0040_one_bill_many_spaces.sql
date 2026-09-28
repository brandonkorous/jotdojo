-- One bill, many spaces. Issue 051, ADR-119.
--
-- Kwabena paid $9 for Family -- "up to 6 people" -- then made the space he
-- actually wanted to share. It arrived on `free`, seating one, with three plan
-- buttons underneath asking him for $9 again. The pricing card promises
-- "Shared spaces, one bill" and only one of his spaces was covered.
--
-- `spaces.billed_with` is the whole idea. NULL means a space pays for itself;
-- a value means it RIDES on that space's subscription. `spaces.plan` stays the
-- single source of truth for what a space is ALLOWED -- riders are kept in
-- step with their payer rather than read through a join -- so metering, seats
-- and entitlement are all correct without being told any of this exists.
--
-- READINGS ARE POOLED AND SEATS ARE NOT, and the asymmetry is the pricing.
-- Readings are the cost of goods (ADR-007, ADR-036): a fresh 2,000 per new
-- space turns $9 into an unbounded vision bill. Seats were never the fence
-- (ADR-112), so each space in a group holds the plan's number -- which for a
-- house of six is the same six people in every room.

ALTER TABLE spaces
  ADD COLUMN billed_with uuid REFERENCES spaces(id) ON DELETE SET NULL;

COMMENT ON COLUMN spaces.billed_with IS
  'The space whose subscription pays for this one. NULL means it pays for itself. Issue 051.';

CREATE INDEX spaces_billed_with_idx ON spaces (billed_with) WHERE billed_with IS NOT NULL;

-- ------------------------------------------------------------ the group ----
--
-- ONE HOP, NEVER A CHAIN. Nothing here ever points a space at another rider:
-- app_billing_payer only returns a space with `billed_with IS NULL`, so a root
-- is always exactly one step away and none of this needs recursion.

CREATE OR REPLACE FUNCTION app_billing_root(p_space uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(billed_with, id) FROM spaces WHERE id = p_space
$$;

-- Which of this person's spaces is already paying, if any.
--
-- Best plan first, so a Team owner's new space does not ride a Family bill
-- they also happen to hold; then oldest, so the answer does not change
-- underneath somebody between one space and the next.
CREATE OR REPLACE FUNCTION app_billing_payer(p_owner uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id
    FROM spaces s
    JOIN space_members m ON m.space_id = s.id AND m.user_id = p_owner AND m.role = 'owner'
    JOIN space_billing b ON b.space_id = s.id
   WHERE s.billed_with IS NULL
     AND s.plan <> 'free'
     AND b.status IN ('active','trialing','past_due')
   ORDER BY CASE s.plan WHEN 'team' THEN 3 WHEN 'family' THEN 2 ELSE 1 END DESC,
            s.created_at
   LIMIT 1
$$;

REVOKE ALL ON FUNCTION app_billing_root(uuid)  FROM PUBLIC;
REVOKE ALL ON FUNCTION app_billing_payer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_billing_root(uuid)  TO jotacular_app;
GRANT EXECUTE ON FUNCTION app_billing_payer(uuid) TO jotacular_app;

-- --------------------------------------------------------------- pooled ----
--
-- The allowance a group gets is its PAYER's, and the usage counted against it
-- is every space in the group. Both halves move together: one space's usage
-- against the payer's allowance would hand out the full 2,000 once per room.

CREATE OR REPLACE FUNCTION app_space_usage(p_space uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(sum(u.units), 0)::integer
    FROM recognition_usage u
   WHERE u.created_at >= app_period_start()
     AND u.space_id IN (
       SELECT s.id FROM spaces s
        WHERE COALESCE(s.billed_with, s.id) = app_billing_root(p_space))
$$;

CREATE OR REPLACE FUNCTION app_space_over_quota(p_space uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_space_usage(p_space)
       >= app_plan_allowance(
            (SELECT plan FROM spaces WHERE id = app_billing_root(p_space)))
$$;

-- ------------------------------------------------------- what is bought ----
--
-- A subscription now entitles a GROUP. The riders are updated in the same
-- statement as the payer, so no reader can catch the group half-moved.

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

  -- A rider has no subscription of its own and must never grow one. That
  -- second bill is what this whole migration exists to prevent.
  IF (SELECT billed_with FROM spaces WHERE id = p_space_id) IS NOT NULL THEN
    RAISE EXCEPTION 'that space is already paid for by another'
      USING ERRCODE = 'check_violation';
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

  UPDATE spaces SET plan = v_entitled
   WHERE id = p_space_id OR billed_with = p_space_id;
END;
$$;

CREATE OR REPLACE FUNCTION app_cancel_subscription(p_space_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE space_billing
     SET status = 'canceled', plan = 'free', updated_at = now()
   WHERE space_id = p_space_id;
  -- Down to free, never below it, and the rooms go with the house. Notes are
  -- never deleted for non-payment; recognition simply defers again.
  UPDATE spaces SET plan = 'free'
   WHERE id = p_space_id OR billed_with = p_space_id;
END;
$$;

-- ----------------------------------------------------------- a new space ---
--
-- The half somebody actually sees: a space made by a person who already pays
-- arrives ON their plan, not on free with a price list underneath it.

CREATE OR REPLACE FUNCTION app_create_space(
  p_name  text,
  p_kind  text,
  p_owner uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_space uuid;
  v_payer uuid;
BEGIN
  IF p_kind NOT IN ('family','team') THEN
    RAISE EXCEPTION 'a shared space is family or team' USING ERRCODE = 'check_violation';
  END IF;
  -- The caller is the acting user or nothing. Passing someone else's id would
  -- let the app create a space owned by a person who never asked for one.
  IF p_owner IS DISTINCT FROM app_actor_id() THEN
    RAISE EXCEPTION 'a space is created by its owner' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_payer := app_billing_payer(p_owner);

  INSERT INTO spaces (name, kind, created_by, billed_with, plan)
  VALUES (p_name, p_kind, p_owner, v_payer,
          COALESCE((SELECT plan FROM spaces WHERE id = v_payer), 'free'))
    RETURNING id INTO v_space;
  INSERT INTO space_members (space_id, user_id, role) VALUES (v_space, p_owner, 'owner');
  RETURN v_space;
END;
$$;

-- ------------------------------------------------------------- orphans -----
--
-- A payer that goes away must not leave its rooms entitled to a plan nobody
-- pays for. BEFORE DELETE rather than ON DELETE SET NULL, because the foreign
-- key clears the pointer and leaves the plan standing behind it.

CREATE OR REPLACE FUNCTION app_billing_orphans() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE spaces SET billed_with = NULL, plan = 'free' WHERE billed_with = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER spaces_billing_orphans BEFORE DELETE ON spaces
  FOR EACH ROW EXECUTE FUNCTION app_billing_orphans();

-- -------------------------------------------------------- joining later ----
--
-- Attaching at creation covers Kwabena's order: pay, then make the room. The
-- other order is just as common -- make the room, find it holds one, then pay
-- -- and that space already exists. Nothing can adopt it retroactively without
-- guessing which of somebody's spaces they meant, so it is a control rather
-- than a rule.
--
-- And its undo, because startCheckout refuses a rider. Without a way back out,
-- joining would be a door that locks behind you.

CREATE OR REPLACE FUNCTION app_join_billing(p_space uuid, p_payer uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan text;
BEGIN
  IF NOT app_is_space_owner(p_space) OR NOT app_is_space_owner(p_payer) THEN
    RAISE EXCEPTION 'both spaces are yours or neither'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_space = p_payer THEN
    RAISE EXCEPTION 'a space does not pay for itself twice' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM space_billing WHERE space_id = p_space) THEN
    RAISE EXCEPTION 'that space has a subscription of its own' USING ERRCODE = 'check_violation';
  END IF;

  -- A payer pays for itself and is actually paying. Riding a rider would make
  -- the chain this file spent its first paragraph ruling out.
  SELECT s.plan INTO v_plan FROM spaces s
    JOIN space_billing b ON b.space_id = s.id
   WHERE s.id = p_payer AND s.billed_with IS NULL AND s.plan <> 'free'
     AND b.status IN ('active','trialing','past_due');
  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'that space is not paying for anything' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE spaces SET billed_with = p_payer, plan = v_plan WHERE id = p_space;
END;
$$;

CREATE OR REPLACE FUNCTION app_leave_billing(p_space uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT app_is_space_owner(p_space) THEN
    RAISE EXCEPTION 'that space is not yours' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- Back to free, which is where it came from. Nothing is deleted, and it can
  -- be put on a plan of its own from the account page afterwards.
  UPDATE spaces SET billed_with = NULL, plan = 'free'
   WHERE id = p_space AND billed_with IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION app_join_billing(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_leave_billing(uuid)      FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_join_billing(uuid, uuid) TO jotacular_app;
GRANT EXECUTE ON FUNCTION app_leave_billing(uuid)      TO jotacular_app;

-- -------------------------------------------------------------- already ----
--
-- Anybody who already paid and already made a second space. Nobody has paid on
-- the live deployment yet, so this is expected to match nothing there. It is
-- for the development and test data, where it matches plenty.

WITH payer AS (
  SELECT DISTINCT ON (m.user_id)
         m.user_id, s.id AS space_id, s.plan
    FROM spaces s
    JOIN space_members m ON m.space_id = s.id AND m.role = 'owner'
    JOIN space_billing b ON b.space_id = s.id
   WHERE s.plan <> 'free'
     AND b.status IN ('active','trialing','past_due')
   ORDER BY m.user_id,
            CASE s.plan WHEN 'team' THEN 3 WHEN 'family' THEN 2 ELSE 1 END DESC,
            s.created_at
)
UPDATE spaces r
   SET billed_with = payer.space_id, plan = payer.plan
  FROM payer
  JOIN space_members rm ON rm.user_id = payer.user_id AND rm.role = 'owner'
 WHERE r.id = rm.space_id
   AND r.id <> payer.space_id
   AND r.plan = 'free'
   AND r.kind IN ('family','team')
   AND r.billed_with IS NULL;
