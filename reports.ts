import { Obstacle, ObstacleType } from "../types";

// Local MVP storage. Replace with Supabase insert + moderation before public launch.
const reports: Obstacle[] = [];

export function addLocalReport(input: {
  type: ObstacleType;
  latitude: number;
  longitude: number;
  note: string;
}): Obstacle {
  const item: Obstacle = {
    ...input,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    verified: false,
    reportedAt: new Date().toISOString(),
  };
  reports.unshift(item);
  return item;
}

export function getLocalReports() {
  return [...reports];
}
