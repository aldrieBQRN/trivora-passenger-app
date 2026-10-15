/**
 * Pick-up distance label — identical rule in the Driver app (utils/geo.ts) so both apps read the
 * same: under 1 km → exact whole meters ("23 m"), else km to at most 2 decimals ("1.12 km",
 * "1.5 km", "2 km").
 */
export function formatPickupDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${Number(km.toFixed(2))} km`;
}
