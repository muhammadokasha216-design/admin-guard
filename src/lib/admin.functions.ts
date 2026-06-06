import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SUPER_OWNER_EMAIL = "muhammadokasha216@gmail.com";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("is_admin, account_status, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !data.is_admin || data.account_status !== "active") {
    throw new Error("Forbidden: admin only");
  }
  return data;
}

export const listProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, user_id, email, display_name, team, role, is_admin, is_approved, account_status, subscription_status, last_active, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { profiles: data ?? [] };
  });

const updateProfileSchema = z.object({
  user_id: z.string().uuid(),
  patch: z
    .object({
      is_approved: z.boolean().optional(),
      is_admin: z.boolean().optional(),
      role: z.enum(["member", "admin", "super_admin"]).optional(),
      account_status: z.enum(["pending", "active", "suspended"]).optional(),
      display_name: z.string().max(120).optional(),
      team: z.string().max(120).nullable().optional(),
      email: z.string().email().max(254).optional(),
    })
    .refine((p) => Object.keys(p).length > 0, "patch is empty"),
});

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateProfileSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Look up target
    const { data: target, error: targetErr } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (targetErr) throw new Error(targetErr.message);
    if (!target) throw new Error("Profile not found");

    // Super owner is protected by DB trigger too, but block early with a clearer error.
    if (target.email === SUPER_OWNER_EMAIL) {
      const blocked = (["is_approved", "is_admin", "role", "account_status", "email"] as const).some(
        (k) => k in data.patch,
      );
      if (blocked) {
        throw new Error("Cannot modify super owner privileges or email");
      }
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update(data.patch)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const approveSchema = z.object({
  user_id: z.string().uuid(),
  approve: z.boolean(),
});

export const setApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => approveSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        is_approved: data.approve,
        account_status: data.approve ? "active" : "suspended",
      })
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
