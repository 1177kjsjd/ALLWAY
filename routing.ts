import { VALHALLA_URL } from "../config";
import { MobilityMode, RouteResult } from "../types";

type Point = { latitude: number; longitude: number };

export async function getWalkingRoute(
  origin: Point,
  destination: Point,
  mode: MobilityMode
): Promise<RouteResult> {
  // Valhalla's pedestrian costing is the baseline. Wheelchair/blind-specific
  // attributes vary by server build and OSM coverage; do not imply full coverage.
  const costingOptions =
    mode === "wheelchair"
      ? { pedestrian: { type: "wheelchair", use_ferry: 0 } }
      : mode === "blind"
      ? { pedestrian: { type: "blind", use_ferry: 0 } }
      : { pedestrian: { use_ferry: 0 } };

  const response = await fetch(VALHALLA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      locations: [
        { lat: origin.latitude, lon: origin.longitude },
        { lat: destination.latitude, lon: destination.longitude },
      ],
      costing: "pedestrian",
      costing_options: costingOptions,
      units: "kilometers",
      language: "de-DE",
      directions_options: { units: "kilometers" },
    }),
  });

  if (!response.ok) {
    throw new Error(`경로 서버 오류 (${response.status}). 잠시 후 다시 시도해 주세요.`);
  }

  const data = await response.json();
  const trip = data.trip;
  const leg = trip?.legs?.[0];
  if (!leg?.shape) throw new Error("경로를 찾지 못했습니다.");

  const coordinates = decodePolyline(leg.shape, 6);
  const maneuvers = (leg.maneuvers || []).map((m: any) =>
    [m.instruction, m.verbal_pre_transition_instruction].filter(Boolean).join(" ")
  );

  return {
    coordinates,
    distanceKm: Number(trip.summary?.length || 0),
    durationMinutes: Math.round(Number(trip.summary?.time || 0) / 60),
    instructions: maneuvers,
    warning:
      "지도 데이터에 없는 턱·공사·점자블록 상태는 반영되지 않을 수 있습니다. 실제 이동 전 주변을 확인하세요.",
  };
}

function decodePolyline(encoded: string, precision = 6) {
  let index = 0, lat = 0, lng = 0;
  const coordinates: { latitude: number; longitude: number }[] = [];
  const factor = Math.pow(10, precision);

  while (index < encoded.length) {
    let result = 0, shift = 0, byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0; shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push({ latitude: lat / factor, longitude: lng / factor });
  }
  return coordinates;
}
