import type { GameEvent } from "@/types";

/**
 * Highlight Extraction System
 * Extracts video segments around key basketball events
 * Supports filtering by player and action type
 */

export interface HighlightClip {
  id: string;
  eventId: string;
  eventType: string;
  teamId: string;
  playerId?: string;
  startTime: number;
  endTime: number;
  duration: number;
  description: string;
}

export interface HighlightFilter {
  playerIds?: string[]; // Filter by specific players
  eventTypes?: string[]; // Filter by event types
  teamIds?: string[]; // Filter by teams
  minConfidence?: number; // Minimum confidence threshold
}

/**
 * Extract highlight clips from game events
 * @param events - All game events
 * @param beforeBuffer - Seconds to include before event (default: 3s)
 * @param afterBuffer - Seconds to include after event (default: 7s)
 */
export function extractHighlights(
  events: GameEvent[],
  beforeBuffer: number = 3.0,
  afterBuffer: number = 7.0,
  minConfidence: number = 0.7 // High confidence only for highlight videos
): HighlightClip[] {
  const highlights: HighlightClip[] = [];

  // Create highlights for ALL events (not just specific types)
  // This allows users to see every detected event in the timeline
  for (const event of events) {
    // Skip very low-confidence events (but be inclusive)
    if (event.confidence < minConfidence) {
      continue;
    }

    const startTime = Math.max(0, event.timestamp - beforeBuffer);
    const endTime = event.timestamp + afterBuffer;
    const duration = endTime - startTime;

    // Skip highlights with zero or negative duration
    if (duration <= 0) {
      console.warn(
        `❌ Skipping highlight with invalid duration: ${duration}s for event ${event.id}`
      );
      continue;
    }

    // Skip highlights that are too short (minimum 10 seconds total)
    if (duration < 10.0) {
      console.log(
        `⏭️ Skipping highlight (too short): ${duration.toFixed(2)}s for ${
          event.type
        } at ${event.timestamp.toFixed(1)}s`
      );
      continue;
    }

    highlights.push({
      id: `highlight-${event.id}`,
      eventId: event.id,
      eventType: event.type,
      teamId: event.teamId,
      playerId: event.playerId,
      startTime,
      endTime,
      duration,
      description: generateHighlightDescription(event),
    });
  }

  console.log(
    `✅ Extracted ${highlights.length} highlights from ${events.length} events (min confidence: ${minConfidence}, min duration: 10.0s)`
  );
  return highlights;
}

/**
 * Filter highlights based on criteria
 */
export function filterHighlights(
  highlights: HighlightClip[],
  filter: HighlightFilter
): HighlightClip[] {
  let filtered = highlights;

  // Filter by player IDs
  if (filter.playerIds && filter.playerIds.length > 0) {
    filtered = filtered.filter(
      (h) => h.playerId && filter.playerIds!.includes(h.playerId)
    );
  }

  // Filter by event types
  if (filter.eventTypes && filter.eventTypes.length > 0) {
    filtered = filtered.filter((h) => filter.eventTypes!.includes(h.eventType));
  }

  // Filter by teams
  if (filter.teamIds && filter.teamIds.length > 0) {
    filtered = filtered.filter((h) => filter.teamIds!.includes(h.teamId));
  }

  return filtered;
}

/**
 * Group highlights by player
 */
export function groupHighlightsByPlayer(
  highlights: HighlightClip[]
): Map<string, HighlightClip[]> {
  const grouped = new Map<string, HighlightClip[]>();

  for (const highlight of highlights) {
    const playerId = highlight.playerId || "unknown";

    if (!grouped.has(playerId)) {
      grouped.set(playerId, []);
    }

    grouped.get(playerId)!.push(highlight);
  }

  return grouped;
}

/**
 * Group highlights by event type
 */
export function groupHighlightsByType(
  highlights: HighlightClip[]
): Map<string, HighlightClip[]> {
  const grouped = new Map<string, HighlightClip[]>();

  for (const highlight of highlights) {
    if (!grouped.has(highlight.eventType)) {
      grouped.set(highlight.eventType, []);
    }

    grouped.get(highlight.eventType)!.push(highlight);
  }

  return grouped;
}

/**
 * Generate descriptive text for highlight
 * Supports all event types
 */
function generateHighlightDescription(event: GameEvent): string {
  const playerText = event.playerId ? `Player ${event.playerId}` : "Player";

  switch (event.type) {
    case "score":
      return `${playerText} scores ${event.scoreDelta || 2} points`;
    case "dunk":
      return `${playerText} dunks!`;
    case "block":
      return `${playerText} blocks the shot!`;
    case "steal":
      return `${playerText} steals the ball!`;
    case "assist":
      return `${playerText} assists!`;
    case "3pt":
      return `${playerText} makes a 3-pointer!`;
    case "shot_attempt":
      return `${playerText} attempts a shot`;
    case "missed_shot":
      return `${playerText} misses the shot`;
    case "offensive_rebound":
      return `${playerText} offensive rebound`;
    case "defensive_rebound":
      return `${playerText} defensive rebound`;
    case "turnover":
      return `${playerText} turnover`;
    case "pass":
      return `${playerText} passes the ball`;
    case "dribble":
      return `${playerText} dribbles`;
    case "foul_shot":
      return `${playerText} free throw attempt`;
    case "layup":
      return `${playerText} layup`;
    case "long_distance_attempt":
      return `${playerText} long distance attempt`;
    default:
      return `${playerText} - ${String(event.type).replace(/_/g, " ")}`;
  }
}

/**
 * Merge overlapping highlight clips
 * When multiple highlights occur close together, merge them
 */
export function mergeOverlappingHighlights(
  highlights: HighlightClip[],
  maxGap: number = 1.0
): HighlightClip[] {
  if (highlights.length === 0) return [];

  // Sort by start time
  const sorted = [...highlights].sort((a, b) => a.startTime - b.startTime);

  const merged: HighlightClip[] = [];
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // Check if next highlight starts within maxGap of current end
    if (next.startTime - current.endTime <= maxGap) {
      // Merge: extend current highlight to include next
      current = {
        ...current,
        id: `${current.id}-merged`,
        endTime: Math.max(current.endTime, next.endTime),
        duration: Math.max(current.endTime, next.endTime) - current.startTime,
        description: `${current.description} + ${next.description}`,
      };
    } else {
      // No overlap, save current and start new
      merged.push(current);
      current = next;
    }
  }

  // Add last highlight
  merged.push(current);

  return merged;
}

/**
 * Get top N highlights by event significance
 * Prioritizes: dunks > 3pt > blocks > scores > steals > assists > rebounds > shots
 */
export function getTopHighlights(
  highlights: HighlightClip[],
  count: number = 10
): HighlightClip[] {
  const eventPriority: { [key: string]: number } = {
    dunk: 10,
    "3pt": 9,
    block: 8,
    score: 7,
    steal: 6,
    foul_shot: 5.5, // Free throws are significant
    assist: 5,
    layup: 4.5,
    offensive_rebound: 4,
    defensive_rebound: 3,
    shot_attempt: 2,
    pass: 1.5,
    dribble: 1,
    turnover: 2.5,
    missed_shot: 2,
    long_distance_attempt: 3.5,
  };

  return [...highlights]
    .sort((a, b) => {
      const priorityA = eventPriority[a.eventType] || 0;
      const priorityB = eventPriority[b.eventType] || 0;
      return priorityB - priorityA;
    })
    .slice(0, count);
}
