'use client';
import { useJourney } from '@/hooks/session';
import { InstructorHome } from './InstructorHome';
import { PrincipalHome } from './PrincipalHome';

export function HomeScreen() {
  return useJourney().homeVariant === 'institute' ? <PrincipalHome /> : <InstructorHome />;
}
