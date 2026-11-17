// make.fun's public API: read-only GET requests, open to any origin (CORS).
// The full API is described at https://make.fun/api/openapi.json.
// Answers are cached in memory for 60 s so a view that re-renders (back, tab
// switch, sort change) does not refetch: few requests a view, fresh data.

const API = 'https://make.fun/api';
const TTL_MS = 60_000;

/** path -> { at, data } */
const cache = new Map();

export function clearCache() {
  cache.clear();
}

async function get(path) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  let res;
  try {
    res = await fetch(API + path);
  } catch (err) {
    throw new Error(`Could not reach make.fun (${err.message || 'network error'})`);
  }
  if (!res.ok) {
    const err = new Error(`make.fun answered ${res.status} for ${path}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  cache.set(path, { at: Date.now(), data });
  return data;
}

/** Every bounty, open and closed (activity=times keeps the board light). */
export const getCompetitions = () => get('/competitions?activity=times');

/** One bounty, by its slug. */
export const getBounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

/** One bounty's leaderboard: { columns, entries }. */
export const getLeaderboard = (slug) => get(`/competitions/${encodeURIComponent(slug)}/leaderboard`);

/** One account's public profile, by handle. */
export const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);
