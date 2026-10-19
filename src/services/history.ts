// Client for the daily model history (server/history.ts). The endpoint only
// exists on the dev server and the container — on plain static hosting every
// call fails and the 2D Matrix simply shows no timeline.
import type { ProcessedModel } from '../types/openrouter';
import { processSnapshot, type RawSnapshot } from './modelService';

const HISTORY_ROUTE = '/__history';

// Changes vs. the previous recorded day — what the timeline histogram plots.
export interface DaySummary {
  date: string;
  synthetic: boolean;
  count: number;
  added: number;
  removed: number;
  repriced: number;
  rescored: number;
}

export async function fetchHistoryIndex(): Promise<DaySummary[] | null> {
  try {
    const response = await fetch(HISTORY_ROUTE);
    if (!response.ok) return null;
    const json = await response.json();
    return Array.isArray(json.days) ? json.days : null;
  } catch {
    return null;
  }
}

// Stores today's fetch (the server picks the date and keeps one record per day).
export async function saveSnapshot(snapshot: RawSnapshot): Promise<boolean> {
  try {
    const response = await fetch(HISTORY_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Processed days are kept for the session: scrubbing back and forth re-renders
// from memory, and a past day's record never changes.
const dayCache = new Map<string, Promise<ProcessedModel[]>>();

export function loadDay(date: string): Promise<ProcessedModel[]> {
  let pending = dayCache.get(date);
  if (!pending) {
    pending = fetch(`${HISTORY_ROUTE}/${date}`)
      .then(response => {
        if (!response.ok) throw new Error(`no history record for ${date}`);
        return response.json() as Promise<RawSnapshot>;
      })
      .then(processSnapshot);
    pending.catch(() => dayCache.delete(date));
    dayCache.set(date, pending);
  }
  return pending;
}

// Today's record is replaced by each live fetch, so it must not stay cached.
export function forgetDay(date: string): void {
  dayCache.delete(date);
}
