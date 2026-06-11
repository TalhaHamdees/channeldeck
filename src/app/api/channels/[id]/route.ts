import { auth } from "@/auth";
import { getDb, schema } from "@/db";
import { decryptToken } from "@/lib/crypto";
import { revokeToken } from "@/lib/google/oauth";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();
  const [channel] = await db
    .select()
    .from(schema.channels)
    .where(eq(schema.channels.id, id));

  if (!channel) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await revokeToken(decryptToken(channel.refreshTokenEnc));
  } catch {
    // Token may already be revoked/corrupt — deletion proceeds regardless.
  }

  // Cascades to all metric tables.
  await db.delete(schema.channels).where(eq(schema.channels.id, id));

  return NextResponse.json({ ok: true });
}
