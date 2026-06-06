import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const Route = createFileRoute("/api/public/telegram-approve")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expectedSecret = process.env.TELEGRAM_BOT_SECRET;
        const ownerId = process.env.TELEGRAM_OWNER_USER_ID;
        if (!expectedSecret || !ownerId) {
          return new Response("Server not configured", { status: 500 });
        }

        const headerSecret =
          request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (!safeEqual(headerSecret, expectedSecret)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let update: any;
        try {
          update = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const message = update?.message ?? update?.edited_message;
        const fromId = message?.from?.id;
        const text: string = message?.text ?? "";

        // Only the configured Telegram owner can issue admin commands
        if (String(fromId) !== ownerId) {
          return Response.json({ ok: true, ignored: "not owner" });
        }

        // Commands: "/approve <email>", "/revoke <email>", "/pending"
        const trimmed = text.trim();
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const reply = async (textOut: string) => ({ ok: true, reply: textOut });

        if (trimmed === "/pending" || trimmed === "pending") {
          const { data, error } = await supabaseAdmin
            .from("profiles")
            .select("email, display_name, created_at")
            .eq("account_status", "pending")
            .order("created_at", { ascending: true })
            .limit(25);
          if (error) return Response.json({ ok: false, error: error.message });
          return Response.json(
            await reply(
              data && data.length
                ? data.map((p) => `• ${p.email}`).join("\n")
                : "No pending users.",
            ),
          );
        }

        const cmd = trimmed.match(/^\/?(approve|revoke)\s+(.+)$/i);
        if (!cmd) {
          return Response.json(
            await reply(
              "Commands:\n/approve <email>\n/revoke <email>\n/pending",
            ),
          );
        }
        const action = cmd[1].toLowerCase();
        const email = cmd[2].trim().toLowerCase();
        const approve = action === "approve";

        const { data: target, error: lookupErr } = await supabaseAdmin
          .from("profiles")
          .select("user_id, email")
          .ilike("email", email)
          .maybeSingle();
        if (lookupErr) {
          return Response.json({ ok: false, error: lookupErr.message });
        }
        if (!target) {
          return Response.json(await reply(`No user found for ${email}`));
        }

        const { error: updErr } = await supabaseAdmin
          .from("profiles")
          .update({
            is_approved: approve,
            account_status: approve ? "active" : "suspended",
          })
          .eq("user_id", target.user_id);
        if (updErr) {
          return Response.json({ ok: false, error: updErr.message });
        }

        return Response.json(
          await reply(`${approve ? "Approved" : "Revoked"}: ${target.email}`),
        );
      },
    },
  },
});

