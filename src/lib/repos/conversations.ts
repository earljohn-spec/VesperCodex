import "server-only";
import { execute, newId, nowIso, parseJson, query, queryOne } from "../db";
import type { Conversation, Memory, MemoryKind, Message } from "../types";

interface ConvRow {
  id: string;
  user_id: string;
  title: string;
  summary: string;
  pinned: number;
  archived: number;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message?: string;
}

interface MsgRow {
  id: string;
  conversation_id: string;
  user_id: string;
  role: string;
  content: string;
  strategy: string | null;
  context_used: string;
  created_at: string;
}

interface MemRow {
  id: string;
  user_id: string;
  kind: string;
  label: string;
  detail: string;
  weight: number;
  last_seen_at: string;
  created_at: string;
}

function mapConv(r: ConvRow): Conversation {
  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    summary: r.summary,
    pinned: r.pinned === 1,
    archived: r.archived === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    messageCount: r.message_count ?? 0,
    lastMessage: r.last_message ?? "",
  };
}

function mapMsg(r: MsgRow): Message {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    userId: r.user_id,
    role: r.role === "assistant" ? "assistant" : "user",
    content: r.content,
    strategy: r.strategy,
    contextUsed: parseJson<string[]>(r.context_used, []),
    createdAt: r.created_at,
  };
}

function mapMem(r: MemRow): Memory {
  return {
    id: r.id,
    userId: r.user_id,
    kind: r.kind as MemoryKind,
    label: r.label,
    detail: r.detail,
    weight: r.weight,
    lastSeenAt: r.last_seen_at,
    createdAt: r.created_at,
  };
}

/* ----------------------------- conversations ---------------------------- */

export async function listConversations(userId: string, includeArchived = false): Promise<Conversation[]> {
  return (await query<ConvRow>(
    `SELECT c.*,
            (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count,
            (SELECT m.content FROM messages m WHERE m.conversation_id = c.id
              ORDER BY m.created_at DESC LIMIT 1) AS last_message
     FROM conversations c
     WHERE c.user_id = ? ${includeArchived ? "" : "AND c.archived = 0"}
     ORDER BY c.pinned DESC, c.updated_at DESC`,
    [userId],
  )).map(mapConv);
}

export async function getConversation(userId: string, id: string): Promise<Conversation | null> {
  const r = await queryOne<ConvRow>(
    `SELECT c.*,
            (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
     FROM conversations c WHERE c.id = ? AND c.user_id = ?`,
    [id, userId],
  );
  return r ? mapConv(r) : null;
}

export async function createConversation(
  userId: string,
  input: { title?: string; summary?: string } = {},
): Promise<Conversation> {
  const id = newId("cnv");
  const ts = nowIso();
  await execute(
    `INSERT INTO conversations (id, user_id, title, summary, pinned, archived, created_at, updated_at)
     VALUES (?,?,?,?,0,0,?,?)`,
    [id, userId, input.title?.trim() || "New conversation", input.summary ?? "", ts, ts],
  );
  return (await getConversation(userId, id))!;
}

export async function updateConversation(
  userId: string,
  id: string,
  input: { title?: string; summary?: string; pinned?: boolean; archived?: boolean },
): Promise<Conversation | null> {
  if (!await getConversation(userId, id)) return null;
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (c: string, v: unknown) => {
    sets.push(`${c} = ?`);
    params.push(v);
  };
  if (input.title !== undefined) push("title", input.title.trim() || "Untitled");
  if (input.summary !== undefined) push("summary", input.summary);
  if (input.pinned !== undefined) push("pinned", input.pinned ? 1 : 0);
  if (input.archived !== undefined) push("archived", input.archived ? 1 : 0);
  push("updated_at", nowIso());
  await execute(`UPDATE conversations SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`, [
    ...params,
    id,
    userId,
  ]);
  return await getConversation(userId, id);
}

export async function deleteConversation(userId: string, id: string): Promise<boolean> {
  if (!await getConversation(userId, id)) return false;
  await execute(`DELETE FROM conversations WHERE id = ? AND user_id = ?`, [id, userId]);
  return true;
}

/* -------------------------------- messages ------------------------------ */

export async function listMessages(userId: string, conversationId: string): Promise<Message[]> {
  return (await query<MsgRow>(
    `SELECT * FROM messages WHERE conversation_id = ? AND user_id = ? ORDER BY created_at ASC`,
    [conversationId, userId],
  )).map(mapMsg);
}

export async function addMessage(
  userId: string,
  conversationId: string,
  input: {
    role: "user" | "assistant";
    content: string;
    strategy?: string | null;
    contextUsed?: string[];
    createdAt?: string;
  },
): Promise<Message> {
  const id = newId("msg");
  const ts = input.createdAt ?? nowIso();
  await execute(
    `INSERT INTO messages (id, conversation_id, user_id, role, content, strategy, context_used, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      id,
      conversationId,
      userId,
      input.role,
      input.content,
      input.strategy ?? null,
      JSON.stringify(input.contextUsed ?? []),
      ts,
    ],
  );
  await execute(`UPDATE conversations SET updated_at = ? WHERE id = ?`, [ts, conversationId]);
  const r = (await queryOne<MsgRow>(`SELECT * FROM messages WHERE id = ?`, [id]))!;
  return mapMsg(r);
}

export async function deleteMessage(userId: string, id: string): Promise<boolean> {
  const r = await queryOne<MsgRow>(`SELECT * FROM messages WHERE id = ? AND user_id = ?`, [id, userId]);
  if (!r) return false;
  await execute(`DELETE FROM messages WHERE id = ? AND user_id = ?`, [id, userId]);
  return true;
}

/* -------------------------------- memories ------------------------------ */

export async function listMemories(userId: string, kind?: string): Promise<Memory[]> {
  const clauses = ["user_id = ?"];
  const params: unknown[] = [userId];
  if (kind && kind !== "all") {
    clauses.push("kind = ?");
    params.push(kind);
  }
  return (await query<MemRow>(
    `SELECT * FROM memories WHERE ${clauses.join(" AND ")} ORDER BY weight DESC, last_seen_at DESC`,
    params,
  )).map(mapMem);
}

export async function getMemory(userId: string, id: string): Promise<Memory | null> {
  const r = await queryOne<MemRow>(`SELECT * FROM memories WHERE id = ? AND user_id = ?`, [id, userId]);
  return r ? mapMem(r) : null;
}

export interface MemoryInput {
  kind: MemoryKind;
  label: string;
  detail?: string;
  weight?: number;
}

export async function createMemory(userId: string, input: MemoryInput): Promise<Memory> {
  const id = newId("mem");
  const ts = nowIso();
  await execute(
    `INSERT INTO memories (id, user_id, kind, label, detail, weight, last_seen_at, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id, userId, input.kind, input.label.trim(), input.detail?.trim() ?? "", input.weight ?? 1, ts, ts],
  );
  return (await getMemory(userId, id))!;
}

export async function updateMemory(
  userId: string,
  id: string,
  input: Partial<MemoryInput> & { lastSeenAt?: string },
): Promise<Memory | null> {
  if (!await getMemory(userId, id)) return null;
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (c: string, v: unknown) => {
    sets.push(`${c} = ?`);
    params.push(v);
  };
  if (input.kind !== undefined) push("kind", input.kind);
  if (input.label !== undefined) push("label", input.label.trim());
  if (input.detail !== undefined) push("detail", input.detail.trim());
  if (input.weight !== undefined) push("weight", input.weight);
  if (input.lastSeenAt !== undefined) push("last_seen_at", input.lastSeenAt);
  if (sets.length === 0) return await getMemory(userId, id);
  await execute(`UPDATE memories SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`, [
    ...params,
    id,
    userId,
  ]);
  return await getMemory(userId, id);
}

export async function deleteMemory(userId: string, id: string): Promise<boolean> {
  if (!await getMemory(userId, id)) return false;
  await execute(`DELETE FROM memories WHERE id = ? AND user_id = ?`, [id, userId]);
  return true;
}

export async function touchMemory(userId: string, label: string) {
  await execute(
    `UPDATE memories SET last_seen_at = ?, weight = MIN(weight + 0.15, 5) WHERE user_id = ? AND label = ?`,
    [nowIso(), userId, label],
  );
}
