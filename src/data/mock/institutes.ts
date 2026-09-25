/** Demo master data — institutes. Consumed only by mock repositories. */
import type { Institute } from '@/domain/entities';

export const INSTITUTE_PUNE_ID = 'inst-27410';

export const INSTITUTES: readonly Institute[] = [
  {
    id: INSTITUTE_PUNE_ID,
    code: '27410',
    name: 'Government Industrial Training Institute, Pune',
    shortName: 'Government ITI Pune',
    district: 'Pune District',
    locality: 'Aundh',
    location: { lat: 18.5602, lng: 73.8082 },
  },
  {
    id: 'inst-27613',
    code: '27613',
    name: 'Government Industrial Training Institute, Nashik',
    shortName: 'Government ITI Nashik',
    district: 'Nashik District',
    locality: 'Satpur',
    location: { lat: 19.9975, lng: 73.7453 },
  },
];
