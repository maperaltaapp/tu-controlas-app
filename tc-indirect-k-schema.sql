-- TU CONTROLAS: configurable indirect K per work; versioned in existing V4 owner backups.
-- Additive: old forecasts and BAC records remain untouched.
begin;
alter table public.tc_cost_forecast_snapshots
 add column if not exists k_indirect_pct numeric(7,3)
 check (k_indirect_pct is null or (k_indirect_pct >= 0 and k_indirect_pct <= 100));
alter table public.tc_cost_forecast_snapshots
 add column if not exists cost_includes_indirect boolean;
alter table public.tc_cost_forecast_snapshots
 drop constraint if exists tc_cost_forecast_kind_check;
alter table public.tc_cost_forecast_snapshots
 add constraint tc_cost_forecast_kind_check check(
  (
   snapshot_type in ('offer','pm_initial')
   and forecast_revenue is not null and forecast_revenue > 0
   and actual_cost is null and remaining_cost is null
   and activity_costs = '[]'::jsonb
   and approval_reference is null
   and k_indirect_pct is null
  ) or (
   snapshot_type = 'forecast'
   and forecast_revenue is not null and forecast_revenue > 0
   and actual_cost is not null and remaining_cost is not null
   and abs(total_cost-(actual_cost+remaining_cost)) < 0.01
   and activity_costs = '[]'::jsonb
   and approval_reference is null
   and k_indirect_pct is null
  ) or (
   snapshot_type = 'baseline'
   and total_cost > 0
   and forecast_revenue is null and actual_cost is null and remaining_cost is null
   and approval_reference is not null and length(btrim(approval_reference)) > 0
   and jsonb_typeof(activity_costs) = 'array'
   and jsonb_array_length(activity_costs) > 0
   and k_indirect_pct is null
   and cost_includes_indirect is null
  ) or (
   snapshot_type = 'k_setting'
   and total_cost = 0 and forecast_revenue is null
   and actual_cost is null and remaining_cost is null
   and activity_costs = '[]'::jsonb
   and approval_reference is null
   and cost_includes_indirect is null
  )
 );
-- Existing SELECT/INSERT ownership RLS is reused. UPDATE/DELETE remain denied.
-- NULL K means "not configured"; explicit 0% means configured zero.
comment on column public.tc_cost_forecast_snapshots.k_indirect_pct is
 'Only k_setting rows: indirect percentage of direct work costs; NULL means unset. Not EVM/BAC.';
comment on column public.tc_cost_forecast_snapshots.cost_includes_indirect is
 'On offer, initial PM, and EAC forecasts: true means input total already includes indirects and K must not be added again.';
commit;
