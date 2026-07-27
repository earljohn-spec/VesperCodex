export type EmotionTag =
  | "calm"
  | "grateful"
  | "hopeful"
  | "content"
  | "energized"
  | "focused"
  | "tired"
  | "anxious"
  | "overwhelmed"
  | "frustrated"
  | "lonely"
  | "sad"
  | "numb"
  | "restless"
  | "proud"
  | "relieved";

export const EMOTION_TAGS: EmotionTag[] = [
  "calm",
  "grateful",
  "hopeful",
  "content",
  "energized",
  "focused",
  "proud",
  "relieved",
  "tired",
  "restless",
  "anxious",
  "overwhelmed",
  "frustrated",
  "lonely",
  "sad",
  "numb",
];

export const POSITIVE_EMOTIONS = new Set<EmotionTag>([
  "calm",
  "grateful",
  "hopeful",
  "content",
  "energized",
  "focused",
  "proud",
  "relieved",
]);

export interface User {
  id: string;
  email: string;
  name: string;
  avatarHue: number;
  timezone: string;
  focusAreas: string[];
  onboarded: boolean;
  /** Null until the address is confirmed. Verification is soft — see
   *  src/lib/email-verification.ts. */
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  body: string;
  moodScore: number;
  energyScore: number;
  emotions: EmotionTag[];
  source: "text" | "voice";
  transcriptMs: number | null;
  entryDate: string;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

export type HabitCadence = "daily" | "weekdays" | "weekly";

export interface Habit {
  id: string;
  userId: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  cadence: HabitCadence;
  targetPerWeek: number;
  reminderTime: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HabitWithStats extends Habit {
  currentStreak: number;
  longestStreak: number;
  completionsThisWeek: number;
  completedToday: boolean;
  last14: { date: string; completed: boolean }[];
  adherence: number;
}

export interface HabitLog {
  id: string;
  habitId: string;
  userId: string;
  logDate: string;
  completed: boolean;
  note: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  summary: string;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  lastMessage?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  strategy: string | null;
  contextUsed: string[];
  createdAt: string;
}

export type MemoryKind = "trigger" | "strategy" | "preference" | "milestone" | "person";

export interface Memory {
  id: string;
  userId: string;
  kind: MemoryKind;
  label: string;
  detail: string;
  weight: number;
  lastSeenAt: string;
  createdAt: string;
}

export type DeviceProvider = "apple_watch" | "fitbit" | "oura" | "garmin" | "manual";
export type DeviceStatus = "connected" | "syncing" | "paused" | "error";

export interface Device {
  id: string;
  userId: string;
  provider: DeviceProvider;
  displayName: string;
  status: DeviceStatus;
  battery: number | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Biometric {
  id: string;
  userId: string;
  deviceId: string | null;
  recordedAt: string;
  hrv: number | null;
  restingHr: number | null;
  heartRate: number | null;
  respiration: number | null;
  sleepHours: number | null;
  steps: number | null;
  stressIndex: number;
  createdAt: string;
}

export type InterventionKind =
  | "breathing"
  | "micro_break"
  | "grounding"
  | "movement"
  | "reflection";
export type InterventionStatus = "suggested" | "completed" | "dismissed" | "snoozed";

export interface Intervention {
  id: string;
  userId: string;
  biometricId: string | null;
  kind: InterventionKind;
  title: string;
  detail: string;
  durationSec: number;
  triggerNote: string;
  status: InterventionStatus;
  triggeredAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyncEvent {
  id: string;
  userId: string;
  resource: string;
  action: string;
  payload: Record<string, unknown>;
  status: "pending" | "synced" | "failed";
  createdAt: string;
  syncedAt: string | null;
}
