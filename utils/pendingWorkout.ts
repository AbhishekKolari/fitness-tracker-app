/**
 * Module-level handoff for "open this workout on the Today tab".
 *
 * Why not use router params? Expo Router caches params on tab routes and may
 * dedupe identical-shape navigations even when params change. That made repeat
 * clicks (especially across multiple sessions on the same day) unreliable —
 * only one session's template would actually load on Today. A module-level
 * one-shot signal sidesteps the navigator entirely: the producer writes an
 * intent, then navigates; the consumer (Today's focus effect) reads & clears
 * it before doing anything else.
 */

export type PendingIntent =
  | { kind: 'template'; templateId: number; programId: number }
  | { kind: 'session'; sessionId: number }
  | { kind: 'customRepeat'; sourceSessionId: number };

let pending: PendingIntent | null = null;

export function setPendingIntent(intent: PendingIntent): void {
  pending = intent;
}

export function consumePendingIntent(): PendingIntent | null {
  const i = pending;
  pending = null;
  return i;
}
