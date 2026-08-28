import type { AppUpdateStatus } from '@fuxian/shared-types';
import { useEffect, useState } from 'react';

const initialStatus: AppUpdateStatus = { currentVersion: '', phase: 'idle' };

export const useAppUpdateStatus = (): AppUpdateStatus => {
  const [status, setStatus] = useState<AppUpdateStatus>(initialStatus);

  useEffect(() => {
    let active = true;
    void window.fuxian.getAppUpdateStatus().then((nextStatus) => {
      if (active) setStatus(nextStatus);
    });
    const unsubscribe = window.fuxian.onAppUpdateStatusChanged(setStatus);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return status;
};
