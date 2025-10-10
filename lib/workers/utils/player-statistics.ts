import type { GameEvent, PlayerSummary, TeamSummary } from "@/types";

/**
 * Player Statistics System
 * Generates per-player statistics from game events
 */

/**
 * Generate per-player statistics from events
 */
export function generatePlayerStatistics(
  events: GameEvent[],
  teamId: string
): PlayerSummary[] {
  // Group events by player
  const playerEventsMap = new Map<string, GameEvent[]>();

  for (const event of events) {
    if (event.teamId !== teamId) continue;
    if (!event.playerId) continue; // Skip events without player ID

    if (!playerEventsMap.has(event.playerId)) {
      playerEventsMap.set(event.playerId, []);
    }
    playerEventsMap.get(event.playerId)!.push(event);
  }

  // Generate stats for each player
  const playerStats: PlayerSummary[] = [];

  for (const [playerId, playerEvents] of playerEventsMap) {
    const scoreEvents = playerEvents.filter((e) => e.type === "score");
    const twoPointScores = scoreEvents.filter((e) => e.shotType === "2pt");
    const threePointScores = scoreEvents.filter((e) => e.shotType === "3pt");
    const foulShots = scoreEvents.filter((e) => e.shotType === "1pt");

    const shotAttemptEvents = playerEvents.filter(
      (e) => e.type === "shot_attempt"
    );
    const twoPointAttempts = shotAttemptEvents.filter(
      (e) => e.shotType === "2pt" || !e.shotType
    );
    const threePointAttempts = shotAttemptEvents.filter(
      (e) => e.shotType === "3pt"
    );

    const totalAttempts = shotAttemptEvents.length;
    const totalScores = scoreEvents.length;
    const hitRate = totalAttempts > 0 ? (totalScores / totalAttempts) * 100 : 0;

    const points =
      twoPointScores.length * 2 +
      threePointScores.length * 3 +
      foulShots.length * 1;

    playerStats.push({
      playerId,
      points,
      twoPointScores: twoPointScores.length,
      threePointScores: threePointScores.length,
      foulShots: foulShots.length,
      shotAttempts: totalAttempts,
      twoPointAttempts: twoPointAttempts.length,
      threePointAttempts: threePointAttempts.length,
      hitRate: Math.round(hitRate),
      dunks: playerEvents.filter((e) => e.type === "dunk").length,
      blocks: playerEvents.filter((e) => e.type === "block").length,
      offRebounds: playerEvents.filter((e) => e.type === "offensive_rebound")
        .length,
      defRebounds: playerEvents.filter((e) => e.type === "defensive_rebound")
        .length,
      assists: playerEvents.filter((e) => e.type === "assist").length,
      turnovers: playerEvents.filter((e) => e.type === "turnover").length,
      passes: playerEvents.filter((e) => e.type === "pass").length,
      dribbles: playerEvents.filter((e) => e.type === "dribble").length,
    });
  }

  // Sort by points descending
  playerStats.sort((a, b) => b.points - a.points);

  return playerStats;
}

/**
 * Generate enhanced team summary with per-player breakdown
 */
export function generateTeamSummary(
  events: GameEvent[],
  teamId: string
): TeamSummary {
  const teamEvents = events.filter((e) => e.teamId === teamId);

  const scoreEvents = teamEvents.filter((e) => e.type === "score");
  const twoPointScores = scoreEvents.filter((e) => e.shotType === "2pt");
  const threePointScores = scoreEvents.filter((e) => e.shotType === "3pt");
  const foulShots = scoreEvents.filter((e) => e.shotType === "1pt");

  const points =
    twoPointScores.reduce((sum, e) => sum + (e.scoreDelta || 0), 0) +
    threePointScores.reduce((sum, e) => sum + (e.scoreDelta || 0), 0) +
    foulShots.reduce((sum, e) => sum + (e.scoreDelta || 0), 0);

  return {
    points,
    twoPointScores: twoPointScores.length,
    threePointScores: threePointScores.length,
    foulShots: foulShots.length,
    shotAttempts: teamEvents.filter((e) => e.type === "shot_attempt").length,
    offRebounds: teamEvents.filter((e) => e.type === "offensive_rebound")
      .length,
    defRebounds: teamEvents.filter((e) => e.type === "defensive_rebound")
      .length,
    turnovers: teamEvents.filter((e) => e.type === "turnover").length,
    threePointAttempts: teamEvents.filter(
      (e) => e.type === "shot_attempt" && e.shotType === "3pt"
    ).length,
    blocks: teamEvents.filter((e) => e.type === "block").length,
    dunks: teamEvents.filter((e) => e.type === "dunk").length,
    assists: teamEvents.filter((e) => e.type === "assist").length,
    passes: teamEvents.filter((e) => e.type === "pass").length,
    dribbles: teamEvents.filter((e) => e.type === "dribble").length,
    players: generatePlayerStatistics(events, teamId),
  };
}
