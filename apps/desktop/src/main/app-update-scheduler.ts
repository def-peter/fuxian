export const appUpdateInitialCheckDelay = 10_000;
export const appUpdateCheckInterval = 24 * 60 * 60 * 1_000;

interface AppUpdateSchedulerOptions {
  check(): Promise<unknown> | unknown;
  initialDelay?: number;
  interval?: number;
  reportError?(error: unknown): void;
}

export interface AppUpdateScheduler {
  stop(): void;
}

export const scheduleAppUpdateChecks = ({
  check,
  initialDelay = appUpdateInitialCheckDelay,
  interval = appUpdateCheckInterval,
  reportError = (error) => console.error('[app-update] scheduled check failed', error),
}: AppUpdateSchedulerOptions): AppUpdateScheduler => {
  let stopped = false;
  const run = (): void => {
    if (stopped) return;
    void Promise.resolve().then(check).catch(reportError);
  };
  const initialTimer = setTimeout(run, initialDelay);
  const recurringTimer = setInterval(run, interval);
  initialTimer.unref();
  recurringTimer.unref();

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearTimeout(initialTimer);
      clearInterval(recurringTimer);
    },
  };
};
