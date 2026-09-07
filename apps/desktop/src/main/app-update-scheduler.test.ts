import { afterEach, describe, expect, it, vi } from 'vitest';
import { scheduleAppUpdateChecks } from './app-update-scheduler';

afterEach(() => {
  vi.useRealTimers();
});

describe('scheduleAppUpdateChecks', () => {
  it('checks after startup and once per day while the app remains open', async () => {
    vi.useFakeTimers();
    const check = vi.fn(async () => undefined);
    const scheduler = scheduleAppUpdateChecks({ check });

    await vi.advanceTimersByTimeAsync(9_999);
    expect(check).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1_000 - 10_000);
    expect(check).toHaveBeenCalledTimes(2);

    scheduler.stop();
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1_000);
    expect(check).toHaveBeenCalledTimes(2);
  });

  it('contains a failed background check without stopping later checks', async () => {
    vi.useFakeTimers();
    const check = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);
    const reportError = vi.fn();
    const scheduler = scheduleAppUpdateChecks({
      check,
      initialDelay: 5,
      interval: 10,
      reportError,
    });

    await vi.advanceTimersByTimeAsync(5);
    expect(reportError).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(5);
    expect(check).toHaveBeenCalledTimes(2);

    scheduler.stop();
  });
});
