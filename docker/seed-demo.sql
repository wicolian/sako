-- Sako demo data for the platform database.
-- 1. Start the stack and sign up once in the client portal (http://localhost:5173).
-- 2. Run:  docker compose exec -T postgres psql -U sako -d platform < docker/seed-demo.sql
-- It gives the newest user a workspace with an active plan, a brand and 5 tasks,
-- and makes them an admin so they can open the studio too.
-- Safe to run more than once.

DO $$
DECLARE
  uid text;
BEGIN
  SELECT id INTO uid FROM users ORDER BY "createdAt" DESC LIMIT 1;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No users yet. Sign up in the client portal first, then run this again.';
  END IF;

  INSERT INTO workspaces (id, name, slug, "updatedAt", "hasOnboarded")
  VALUES ('ws_demo', 'Acme Growth', 'acme-growth', now(), true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO workspace_members (id, "workspaceId", "userId", role, "updatedAt")
  VALUES ('wm_demo_' || uid, 'ws_demo', uid, 'OWNER', now())
  ON CONFLICT DO NOTHING;

  INSERT INTO subscriptions (id, "workspaceId", status, "planCode", "activeTaskLimit", "slaSeconds",
                             "billingPeriodStart", "billingPeriodEnd", "updatedAt")
  VALUES ('sub_demo', 'ws_demo', 'ACTIVE', 'OPS', 2, 172800, now(), now() + interval '30 days', now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO brands (id, "workspaceId", name, "updatedAt")
  VALUES ('br_demo', 'ws_demo', 'Acme', now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO tasks (id, "workspaceId", "brandId", title, description, category, status, "createdById",
                     "updatedAt", "createdAt", "inProgressAt", "slaSeconds") VALUES
    ('demo_t1', 'ws_demo', 'br_demo', 'Q4 launch landing page hero', 'New hero for the Q4 launch, 3 variants.', 'DESIGN', 'IN_PROGRESS', uid, now(), now() - interval '20 hours', now() - interval '18 hours', 172800),
    ('demo_t2', 'ws_demo', 'br_demo', 'LinkedIn ad set: 5 static ads', 'Carousel + 4 singles for the webinar.', 'DESIGN', 'IN_REVIEW', uid, now(), now() - interval '2 days', now() - interval '40 hours', 172800),
    ('demo_t3', 'ws_demo', 'br_demo', 'Pitch deck refresh', 'Update 12 slides to the new brand.', 'DESIGN', 'QUEUED', uid, now(), now() - interval '3 hours', NULL, 172800),
    ('demo_t4', 'ws_demo', 'br_demo', 'Case study one-pager', 'PDF for the sales team.', 'DESIGN', 'COMPLETED', uid, now(), now() - interval '6 days', now() - interval '5 days', 172800),
    ('demo_t5', 'ws_demo', 'br_demo', 'Product teaser video', '15-second motion teaser.', 'MOTION', 'COMPLETED', uid, now(), now() - interval '9 days', now() - interval '8 days', 172800)
  ON CONFLICT (id) DO NOTHING;

  UPDATE users SET role = 'ADMIN' WHERE id = uid;
  RAISE NOTICE 'Demo data ready for user %', uid;
END $$;
