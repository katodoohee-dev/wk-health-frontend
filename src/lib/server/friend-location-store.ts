export type LiveLocation = {
  friendId: string;
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speedMps?: number;
  updatedAt: string;
};

type ShareState = { enabled: boolean; updatedAt: string };

type Store = {
  shares: Map<string, ShareState>;
  locations: Map<string, LiveLocation>;
};

type GlobalStore = typeof globalThis & { __wkFriendLocationStore?: Store };

const root = globalThis as GlobalStore;
const store: Store = root.__wkFriendLocationStore ?? {
  shares: new Map<string, ShareState>(),
  locations: new Map<string, LiveLocation>(),
};
root.__wkFriendLocationStore = store;

export function getShare(userId: string) {
  return store.shares.get(userId) ?? { enabled: false, updatedAt: new Date(0).toISOString() };
}

export function setShare(userId: string, enabled: boolean) {
  const updatedAt = new Date().toISOString();
  store.shares.set(userId, { enabled, updatedAt });
  if (!enabled) store.locations.delete(userId);
  return { enabled, updatedAt };
}

export function publishLocation(userId: string, input: Omit<LiveLocation, "friendId" | "updatedAt">) {
  const sharing = getShare(userId).enabled;
  if (!sharing) throw new Error("LOCATION_SHARING_DISABLED");
  const location: LiveLocation = { friendId: userId, ...input, updatedAt: new Date().toISOString() };
  store.locations.set(userId, location);
  return location;
}

export function getFreshLocations(friendIds: string[], maxAgeMs = 30_000) {
  const now = Date.now();
  const allowed = new Set(friendIds);
  return Array.from(store.locations.values()).filter((item) =>
    allowed.has(item.friendId) && now - Date.parse(item.updatedAt) <= maxAgeMs,
  );
}
