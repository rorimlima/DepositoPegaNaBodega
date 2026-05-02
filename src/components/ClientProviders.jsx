'use client';

import { useEffect } from 'react';
import { startAutoSync } from '@/lib/syncEngine';

export function ClientProviders({ children }) {
  useEffect(() => {
    // Start auto sync every 30 seconds
    startAutoSync(30000);
  }, []);

  return <>{children}</>;
}
