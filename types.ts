export type MobilityMode = "wheelchair" | "blind" | "walking" | "general";
export type ObstacleType = "stairs" | "blocked" | "broken" | "tactile" | "curb" | "elevator" | "ramp" | "construction";

export type Obstacle = {
  id: string;
  type: ObstacleType;
  latitude: number;
  longitude: number;
  note: string;
  verified: boolean;
  reportedAt: string;
};

export type RouteResult = {
  coordinates: { latitude: number; longitude: number }[];
  distanceKm: number;
  durationMinutes: number;
  instructions: string[];
  warning: string;
};
