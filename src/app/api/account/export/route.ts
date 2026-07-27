import { exportAccount } from "@/lib/account";
import { withUser } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Downloads everything we hold about the signed-in user as JSON. */
export const GET = withUser(async (user) => {
  const bundle = exportAccount(user);
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="vesper-export-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
