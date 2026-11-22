-- TU CONTROLAS · Read-only tenant denial check
-- Execute as Supabase project owner in SQL Editor.
-- Never use a real client UUID or any customer work as a test fixture.
-- This synthetic UUID was verified not to be an auth.users account on 2026-11-22.
-- It tests negative RLS filtering under the authenticated database role.
-- IT IS NOT equivalent to two real JWTs, REST API access or write/RPC tests.
BEGIN TRANSACTION READ ONLY;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000ab',true) AS synthetic_identity;
SELECT
 current_user AS tested_role,
 auth.uid() AS tested_identity,
 (SELECT count(*) FROM public.elite_works) AS obras,
 (SELECT count(*) FROM public.elite_tasks) AS tareas,
 (SELECT count(*) FROM public.elite_work_plans) AS gantt,
 (SELECT count(*) FROM public.elite_plan_versions) AS versiones,
 (SELECT count(*) FROM public.elite_plan_exceptions) AS excepciones,
 (SELECT count(*) FROM public.elite_contractors) AS subcontratas,
 (SELECT count(*) FROM public.elite_work_contractors) AS asignaciones,
 (SELECT count(*) FROM public.elite_work_checklist_items) AS checklists,
 (SELECT count(*) FROM public.elite_daily_reports) AS partes,
 (SELECT count(*) FROM public.elite_incidents) AS incidencias,
 (SELECT count(*) FROM public.elite_capacity_reviews) AS revisiones,
 (SELECT count(*) FROM public.elite_contract_plan_versions) AS contratos,
 (SELECT count(*) FROM public.elite_contract_plan_drafts) AS borradores,
 (SELECT count(*) FROM public.elite_holiday_calendars) AS festivos,
 (SELECT count(*) FROM public.elite_task_orders) AS orden_tareas,
 (SELECT count(*) FROM public.elite_history) AS historial,
 (SELECT count(*) FROM public.elite_push_subscriptions) AS avisos;
ROLLBACK;
-- Expected: every count above is zero. Any nonzero count => NO-GO.
-- This check cannot prove positive ownership or authorization for inserts/updates/deletes.
