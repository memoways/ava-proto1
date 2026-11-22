/**
 * One admin_settings row for every provider plan. Subscriptions are account-level,
 * so the row lives on `prod` even when the admin is looking at a sandbox.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { parseServicePlans, type SavedServicePlan } from "@/services/servicePlans";

export const SERVICE_PLANS_KEY = "billing.service_plans";
const ENVIRONMENT_ID = "prod";

export async function loadServicePlans(): Promise<Record<string, SavedServicePlan>> {
  const { data, error } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", SERVICE_PLANS_KEY)
    .eq("environment_id", ENVIRONMENT_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return parseServicePlans(data?.value ?? null);
}

export async function saveServicePlan(serviceId: string, plan: SavedServicePlan): Promise<Record<string, SavedServicePlan>> {
  const current = await loadServicePlans();
  const plans = { ...current, [serviceId]: plan };
  const { error } = await supabase.from("admin_settings").upsert(
    {
      key: SERVICE_PLANS_KEY,
      environment_id: ENVIRONMENT_ID,
      value: { plans } as unknown as Json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key,environment_id" },
  );
  if (error) throw new Error(error.message);
  return plans;
}
