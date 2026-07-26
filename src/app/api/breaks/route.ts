import { z } from "zod";
import { ok, parseBody, withUser } from "@/lib/api";
import {
  createIntervention,
  listInterventions,
  recommendBreak,
} from "@/lib/repos/interventions";
import { biometricSummary } from "@/lib/repos/biometrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  kind: z.enum(["breathing", "micro_break", "grounding", "movement", "reflection"]).optional(),
  title: z.string().max(120).optional(),
  detail: z.string().max(1000).optional(),
  durationSec: z.number().int().min(30).max(3600).optional(),
  triggerNote: z.string().max(280).optional(),
  /** When true, Vesper picks the break based on current biometrics. */
  auto: z.boolean().optional(),
});

export const GET = withUser(async (user, req: Request) => {
  const url = new URL(req.url);
  return ok({
    interventions: listInterventions(user.id, {
      status: url.searchParams.get("status") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 100),
    }),
  });
});

export const POST = withUser(async (user, req: Request) => {
  const input = await parseBody(req, schema).catch(() => ({ auto: true }) as z.infer<typeof schema>);

  if (input.auto || !input.title) {
    const bio = biometricSummary(user.id);
    const rec = recommendBreak(bio.stressNow, bio.hrvDelta);
    return ok({ intervention: createIntervention(user.id, { ...rec, ...stripUndefined(input) }) }, 201);
  }

  return ok(
    {
      intervention: createIntervention(user.id, {
        kind: input.kind ?? "breathing",
        title: input.title,
        detail: input.detail,
        durationSec: input.durationSec,
        triggerNote: input.triggerNote,
      }),
    },
    201,
  );
});

function stripUndefined<T extends Record<string, unknown>>(o: T) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined && k !== "auto") out[k] = v;
  }
  return out;
}
