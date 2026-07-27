import { z } from "zod";
import { ok, parseBody, withUser } from "@/lib/api";
import { createMemory, listMemories } from "@/lib/repos/conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  kind: z.enum(["trigger", "strategy", "preference", "milestone", "person"]),
  label: z.string().min(1, "Add a short label").max(80),
  detail: z.string().max(600).optional(),
  weight: z.number().min(0).max(5).optional(),
});

export const GET = withUser(async (user, req: Request) => {
  const url = new URL(req.url);
  return ok({ memories: await listMemories(user.id, url.searchParams.get("kind") ?? undefined) });
});

export const POST = withUser(async (user, req: Request) => {
  const input = await parseBody(req, schema);
  return ok({ memory: await createMemory(user.id, input) }, 201);
});
