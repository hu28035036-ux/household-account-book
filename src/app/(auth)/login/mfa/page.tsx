import { Suspense } from 'react';
import MfaChallengeClient from './MfaChallengeClient';

export const dynamic = 'force-dynamic';

export default function MfaChallengePage() {
  return (
    <Suspense fallback={null}>
      <MfaChallengeClient />
    </Suspense>
  );
}
