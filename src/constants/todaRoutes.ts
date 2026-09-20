import { TodaZone, LocationPoint, FareCalculation } from '../types';

export const TODA_ZONES: TodaZone[] = [
  {
    id: 1,
    code: 'TODA-BRGY1',
    name: 'TODA Brgy. 1',
    barangay: 'Barangay 1',
    terminal: 'Brgy. 1 Poblacion Terminal',
    address: 'J.P. Laurel St. cor. Concepcion St., Barangay 1, Nasugbu, Batangas',
    badgeColor: '#1D2542',
    centerLat: 14.0755,
    centerLng: 120.6315,
    coverageKm: 3.0,
    baseFare: 20.0,
    perKmRate: 5.0,
    description: 'Serving Barangay 1 Poblacion commercial center, municipal court, and residences.',
  },
  {
    id: 2,
    code: 'TODA-BRGY2',
    name: 'TODA Brgy. 2',
    barangay: 'Barangay 2',
    terminal: 'Brgy. 2 Central Terminal',
    address: 'F. Alix St., Barangay 2, Nasugbu, Batangas',
    badgeColor: '#1D2542',
    centerLat: 14.0746,
    centerLng: 120.6332,
    coverageKm: 3.0,
    baseFare: 20.0,
    perKmRate: 5.0,
    description: 'Serving Barangay 2, town plaza, and local schools.',
  },
  {
    id: 3,
    code: 'TODA-BRGY3',
    name: 'TODA Brgy. 3',
    barangay: 'Barangay 3',
    terminal: 'Brgy. 3 Plaza Terminal',
    address: 'P. Burgos St. near Town Plaza, Barangay 3, Nasugbu, Batangas',
    badgeColor: '#1D2542',
    centerLat: 14.0738,
    centerLng: 120.6348,
    coverageKm: 3.0,
    baseFare: 20.0,
    perKmRate: 5.0,
    description: 'Serving Barangay 3 perimeter, church, and municipal town square.',
  },
  {
    id: 4,
    code: 'TODA-BRGY4',
    name: 'TODA Brgy. 4',
    barangay: 'Barangay 4',
    terminal: 'Brgy. 4 North Terminal',
    address: 'Concepcion St., Barangay 4, Nasugbu, Batangas',
    badgeColor: '#1D2542',
    centerLat: 14.0673,
    centerLng: 120.6331,
    coverageKm: 3.0,
    baseFare: 20.0,
    perKmRate: 5.0,
    description: 'Covers Barangay 4 residential areas and northern highway junction.',
  },
  {
    id: 5,
    code: 'TODA-BRGY5',
    name: 'TODA Brgy. 5',
    barangay: 'Barangay 5',
    terminal: 'Brgy. 5 Riverside Terminal',
    address: 'Rizal St. cor. Riverbank Rd., Barangay 5, Nasugbu, Batangas',
    badgeColor: '#1D2542',
    centerLat: 14.0718,
    centerLng: 120.6305,
    coverageKm: 3.0,
    baseFare: 20.0,
    perKmRate: 5.0,
    description: 'Serving Barangay 5 community and riverside residences.',
  },
  {
    id: 6,
    code: 'TODA-BRGY6',
    name: 'TODA Brgy. 6',
    barangay: 'Barangay 6',
    terminal: 'Brgy. 6 Heritage Terminal',
    address: 'G. Alvarez St., Barangay 6, Nasugbu, Batangas',
    badgeColor: '#1D2542',
    centerLat: 14.0708,
    centerLng: 120.6322,
    coverageKm: 3.0,
    baseFare: 20.0,
    perKmRate: 5.0,
    description: 'Barangay 6 heritage zone and parish perimeter.',
  },
  {
    id: 7,
    code: 'TODA-BRGY7',
    name: 'TODA Brgy. 7',
    barangay: 'Barangay 7',
    terminal: 'Brgy. 7 East Access Terminal',
    address: 'M.H. Del Pilar St., Barangay 7, Nasugbu, Batangas',
    badgeColor: '#1D2542',
    centerLat: 14.0698,
    centerLng: 120.6348,
    coverageKm: 3.0,
    baseFare: 20.0,
    perKmRate: 5.0,
    description: 'Serving Barangay 7 eastern perimeter and residential subdivisions.',
  },
  {
    id: 8,
    code: 'TODA-BRGY8',
    name: 'TODA Brgy. 8',
    barangay: 'Barangay 8',
    terminal: 'Brgy. 8 South Terminal',
    address: 'P. Gomez St., Barangay 8, Nasugbu, Batangas',
    badgeColor: '#1D2542',
    centerLat: 14.0715,
    centerLng: 120.6330,
    coverageKm: 3.0,
    baseFare: 20.0,
    perKmRate: 5.0,
    description: 'Covers Barangay 8 Poblacion TODA route, hospital access, and clinic district.',
  },
  {
    id: 9,
    code: 'TODA-BRGY9',
    name: 'TODA Brgy. 9',
    barangay: 'Barangay 9',
    terminal: 'Brgy. 9 Public Market Terminal',
    address: 'Market Rd. cor. P. Burgos St., Barangay 9, Nasugbu, Batangas',
    badgeColor: '#1D2542',
    centerLat: 14.0732,
    centerLng: 120.6362,
    coverageKm: 3.0,
    baseFare: 20.0,
    perKmRate: 5.0,
    description: 'Main transport terminal servicing the Nasugbu Public Market.',
  },
  {
    id: 10,
    code: 'TODA-BRGY10',
    name: 'TODA Brgy. 10',
    barangay: 'Barangay 10',
    terminal: 'Brgy. 10 Municipal Terminal',
    address: 'L. De Castro St. near Municipal Hall, Barangay 10, Nasugbu, Batangas',
    badgeColor: '#1D2542',
    centerLat: 14.0725,
    centerLng: 120.6322,
    coverageKm: 3.0,
    baseFare: 20.0,
    perKmRate: 5.0,
    description: 'Covers Barangay 10 TODA route, municipal hall complex, and government center.',
  },
  {
    id: 11,
    code: 'TODA-BUCANA',
    name: 'TODA Bucana',
    barangay: 'Barangay Bucana',
    terminal: 'Bucana Main Coastal Terminal',
    address: 'Bucana Coastal Access Rd., Barangay Bucana, Nasugbu, Batangas',
    badgeColor: '#1D2542',
    centerLat: 14.0640,
    centerLng: 120.6298,
    coverageKm: 3.5,
    baseFare: 20.0,
    perKmRate: 5.0,
    description: 'Covers Bucana coastal, beach resort, fisherman port, and residential TODA route.',
  },
];

export const POPULAR_DESTINATIONS: LocationPoint[] = [
  {
    name: 'Nasugbu Municipal Hall',
    address: 'J.P. Rizal St., Poblacion',
    lat: 14.0718,
    lng: 120.6325,
    zoneCode: 'TODA-BRGY8',
    category: 'Government',
  },
  {
    name: 'Bucana, Nasugbu Batangas',
    address: 'Bridge St., Bucana',
    lat: 14.0638,
    lng: 120.6289,
    zoneCode: 'TODA-BUCANA',
    category: 'Terminal',
  },
  {
    name: 'Trivora Public Market',
    address: 'Market St., Brgy 8',
    lat: 14.0705,
    lng: 120.6341,
    zoneCode: 'TODA-BRGY8',
    category: 'Market',
  },
  {
    name: 'Ospital ng Nasugbu',
    address: 'National Highway, Brgy 10',
    lat: 14.0732,
    lng: 120.6315,
    zoneCode: 'TODA-BRGY10',
    category: 'Hospital',
  },
  {
    name: 'Wawa Port & Baywalk',
    address: 'Coastal Rd., Brgy 4',
    lat: 14.0668,
    lng: 120.6335,
    zoneCode: 'TODA-BRGY4',
    category: 'Harbor',
  },
  {
    name: 'Bucana Beach & Resorts',
    address: 'Sunset Blvd., Bucana',
    lat: 14.0612,
    lng: 120.6241,
    zoneCode: 'TODA-BUCANA',
    category: 'Leisure',
  },
  {
    name: 'Nasugbu West Central School',
    address: 'P. Burgos St., Poblacion',
    lat: 14.0745,
    lng: 120.6355,
    zoneCode: 'TODA-BRGY8',
    category: 'School',
  },
  {
    name: 'SM Savemore Nasugbu',
    address: 'National Highway, Brgy 10',
    lat: 14.0755,
    lng: 120.6308,
    zoneCode: 'TODA-BRGY10',
    category: 'Commercial',
  },
];

export function calculateDistance(loc1: LocationPoint, loc2: LocationPoint): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((loc2.lat - loc1.lat) * Math.PI) / 180;
  const dLng = ((loc2.lng - loc1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((loc1.lat * Math.PI) / 180) *
      Math.cos((loc2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const rawDist = R * c;
  // Fallback to minimum 0.8 km for town tricycles
  return Number(Math.max(0.8, rawDist * 1.35).toFixed(1));
}

export function calculateFare(distanceKm: number, todaZone?: TodaZone | null): FareCalculation {
  const base = todaZone ? todaZone.baseFare : 20.0;
  const rate = todaZone ? todaZone.perKmRate : 5.0;
  const distanceFee = Number((distanceKm * rate).toFixed(2));
  const total = Number((base + distanceFee).toFixed(2));
  const durationMinutes = Math.max(3, Math.round(distanceKm * 3.3));

  return {
    base,
    distanceFee,
    total,
    distanceKm,
    durationMinutes,
  };
}
