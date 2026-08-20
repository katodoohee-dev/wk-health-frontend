import { apiFetch, num, pick, type DiaryItem } from "./api";

export type CompatTrack = { id: string; url: string; title: string; type: "youtube" | "audio"; ytId?: string };

export async function apiMusicLibrary(): Promise<CompatTrack[]> {
  const data = await apiFetch<Record<string, unknown>>("/api/music/library");
  const list = pick<Record<string, unknown>[]>(data, ["tracks", "items", "data", "library"], []);
  return (Array.isArray(list) ? list : []).map((t) => ({
    id: String(pick(t, ["id", "_id"], "")),
    url: String(pick(t, ["url"], "")),
    title: String(pick(t, ["title", "name"], "Untitled")),
    type: pick<"youtube" | "audio">(t, ["type"], "audio"),
    ytId: String(pick(t, ["yt_id", "ytId"], "")) || undefined,
  }));
}

export async function apiMusicHistory(): Promise<Record<string, unknown>[]> {
  const data = await apiFetch<Record<string, unknown>>("/api/music/history");
  return pick<Record<string, unknown>[]>(data, ["history", "items", "data"], []);
}

export async function apiAssistantHistory(): Promise<Record<string, unknown>[]> {
  const data = await apiFetch<Record<string, unknown>>("/api/assistant/history?limit=50");
  return pick<Record<string, unknown>[]>(data, ["history", "items", "messages", "data"], []);
}

export async function apiGallery(): Promise<Record<string, unknown>[]> {
  const data = await apiFetch<Record<string, unknown>>("/api/gallery");
  return pick<Record<string, unknown>[]>(data, ["items", "gallery", "data"], []);
}

export async function apiPedometerToday(): Promise<Record<string, unknown> | null> {
  const data = await apiFetch<Record<string, unknown>>("/api/pedometer/today");
  return pick<Record<string, unknown> | null>(data, ["today", "stats", "data"], data);
}

export async function apiRouteHistory(): Promise<Record<string, unknown>[]> {
  const data = await apiFetch<Record<string, unknown>>("/api/route/history");
  return pick<Record<string, unknown>[]>(data, ["items", "routes", "history", "data"], []);
}

export type CompatWorkout = { id: string; exercise: string; minutes: number; calories: number; startedAt: string };
export async function apiWorkoutHistoryCompat(): Promise<CompatWorkout[]> {
  const data = await apiFetch<Record<string, unknown>>("/api/workout/history");
  const list = pick<Record<string, unknown>[]>(data, ["items", "workouts", "data"], []);
  return (Array.isArray(list) ? list : []).map((w) => ({
    id: String(pick(w, ["id"], "")),
    exercise: String(pick(w, ["exercise", "name", "title"], "")),
    minutes: num(pick(w, ["minutes", "duration"], 0)),
    calories: num(pick(w, ["calories", "kcal"], 0)),
    startedAt: String(pick(w, ["started_at", "startedAt", "created_at"], "")),
  }));
}
