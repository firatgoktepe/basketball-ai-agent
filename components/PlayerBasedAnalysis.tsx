"use client";

import { useState, useMemo } from "react";
import { Users, TrendingUp, Award, Target } from "lucide-react";
import type { GameData } from "@/types";
import { PlayerComparisonCharts } from "./PlayerComparisonCharts";
import { usePlayerFilter } from "./PlayerFilterContext";

interface PlayerBasedAnalysisProps {
  gameData: GameData;
  onPlayerSelect?: (playerId: string, teamId: string) => void;
}

export function PlayerBasedAnalysis({
  gameData,
  onPlayerSelect,
}: PlayerBasedAnalysisProps) {
  const { selectedPlayer, setSelectedPlayer } = usePlayerFilter();
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  // Get player statistics organized by team
  const teamPlayers = useMemo(() => {
    return gameData.teams.map((team) => ({
      team,
      players: gameData.summary[team.id]?.players || [],
    }));
  }, [gameData]);

  // Get player events for detailed view
  const getPlayerEvents = (playerId: string, teamId: string) => {
    return gameData.events.filter(
      (event) => event.playerId === playerId && event.teamId === teamId
    );
  };

  const handlePlayerClick = (playerId: string, teamId: string) => {
    const key = `${teamId}-${playerId}`;
    if (expandedPlayer === key) {
      setExpandedPlayer(null);
      setSelectedPlayer({ playerId: null, teamId: null });
    } else {
      setExpandedPlayer(key);
      setSelectedPlayer({ playerId, teamId });
      onPlayerSelect?.(playerId, teamId);
    }
  };

  const formatStatValue = (value: number) => {
    return value.toLocaleString();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2 flex items-center justify-center gap-2">
          <Users className="w-6 h-6" />
          Player-Based Analysis
        </h2>
        <p className="text-muted-foreground">
          Individual player statistics and performance metrics
        </p>
      </div>

      {/* Team Player Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {teamPlayers.map(({ team, players }) => (
          <div key={team.id} className="space-y-4">
            {/* Team Header */}
            <div
              className="px-4 py-3 rounded-lg font-semibold text-white"
              style={{ backgroundColor: team.color }}
            >
              <div className="flex items-center justify-between">
                <span>{team.label} Team Players</span>
                <span className="text-sm opacity-90">
                  {players.length} player{players.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Player Cards */}
            {players.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border rounded-lg">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No players detected for this team</p>
                <p className="text-sm mt-1">
                  Enable jersey detection to track individual players
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {players.map((player) => {
                  const key = `${team.id}-${player.playerId}`;
                  const isExpanded = expandedPlayer === key;
                  const playerEvents = getPlayerEvents(
                    player.playerId,
                    team.id
                  );

                  return (
                    <div
                      key={key}
                      className={`border rounded-lg transition-all ${
                        isExpanded
                          ? "ring-2 shadow-lg"
                          : "hover:shadow-md hover:border-primary/50"
                      }`}
                      style={{
                        borderColor: isExpanded ? team.color : undefined,
                      }}
                    >
                      {/* Player Header - Clickable */}
                      <button
                        onClick={() =>
                          handlePlayerClick(player.playerId, team.id)
                        }
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-t-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: team.color }}
                          >
                            #{player.playerId}
                          </div>
                          <div className="text-left">
                            <div className="font-semibold">
                              Player #{player.playerId}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {player.points} pts • {player.shotAttempts} att
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {player.hitRate > 0 && (
                            <div className="text-right">
                              <div className="text-lg font-bold text-primary">
                                {player.hitRate}%
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Hit Rate
                              </div>
                            </div>
                          )}
                          <Award
                            className={`w-5 h-5 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </div>
                      </button>

                      {/* Expanded Player Details */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t bg-muted/20">
                          {/* Statistics Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                            {/* Score Breakdown */}
                            <StatCard
                              label="2-Point Scores"
                              value={formatStatValue(player.twoPointScores)}
                              icon={Target}
                              color="text-blue-600"
                            />
                            <StatCard
                              label="3-Point Scores"
                              value={formatStatValue(player.threePointScores)}
                              icon={TrendingUp}
                              color="text-purple-600"
                            />
                            <StatCard
                              label="Foul Shots"
                              value={formatStatValue(player.foulShots)}
                              icon={Target}
                              color="text-orange-600"
                            />

                            {/* Other Stats */}
                            <StatCard
                              label="Dunks"
                              value={formatStatValue(player.dunks)}
                            />
                            <StatCard
                              label="Blocks"
                              value={formatStatValue(player.blocks)}
                            />
                            <StatCard
                              label="Assists"
                              value={formatStatValue(player.assists)}
                            />
                            <StatCard
                              label="Passes"
                              value={formatStatValue(player.passes)}
                            />
                            <StatCard
                              label="Off. Rebounds"
                              value={formatStatValue(player.offRebounds)}
                            />
                            <StatCard
                              label="Def. Rebounds"
                              value={formatStatValue(player.defRebounds)}
                            />
                            <StatCard
                              label="Turnovers"
                              value={formatStatValue(player.turnovers)}
                            />
                            <StatCard
                              label="Dribbles"
                              value={formatStatValue(player.dribbles)}
                            />
                          </div>

                          {/* Player Events Timeline */}
                          {playerEvents.length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                              <h4 className="font-semibold mb-2 text-sm">
                                Event Timeline ({playerEvents.length} events)
                              </h4>
                              <div className="max-h-40 overflow-y-auto space-y-1">
                                {playerEvents
                                  .sort((a, b) => a.timestamp - b.timestamp)
                                  .map((event) => (
                                    <div
                                      key={event.id}
                                      className="text-xs flex items-center gap-2 py-1 px-2 bg-background rounded"
                                    >
                                      <span className="text-muted-foreground font-mono">
                                        {Math.floor(event.timestamp / 60)}:
                                        {Math.floor(event.timestamp % 60)
                                          .toString()
                                          .padStart(2, "0")}
                                      </span>
                                      <span className="font-medium">
                                        {event.type.replace(/_/g, " ")}
                                      </span>
                                      {event.scoreDelta && (
                                        <span className="text-primary font-bold">
                                          +{event.scoreDelta}
                                        </span>
                                      )}
                                      <span className="ml-auto text-muted-foreground">
                                        {(event.confidence * 100).toFixed(0)}%
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Player Comparison Charts */}
      <PlayerComparisonCharts gameData={gameData} />
    </div>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  icon: Icon,
  color = "text-muted-foreground",
}: {
  label: string;
  value: string;
  icon?: any;
  color?: string;
}) {
  return (
    <div className="bg-background border rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {Icon && <Icon className={`w-3 h-3 ${color}`} />}
      </div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}
