import { startScheduler, type CronSchedule } from '../src/scheduler';

describe('startScheduler', () => {
  it('schedules scans with the configured cron expression and timezone', async () => {
    let onTick: (() => void) | undefined;
    const stop = jest.fn();
    const scheduleTask = jest.fn(((expression, callback, options) => {
      expect(expression).toBe('0 7,19 * * *');
      expect(options).toEqual({ timezone: 'Europe/Stockholm' });
      onTick = callback;
      return { stop };
    }) as CronSchedule);
    const scan = jest.fn().mockResolvedValue(undefined);
    const logger = { info: jest.fn(), error: jest.fn() };
    const scheduler = startScheduler(
      { cron: '0 7,19 * * *', timezone: 'Europe/Stockholm' },
      scan,
      logger,
      scheduleTask,
    );

    onTick!();
    await Promise.resolve();
    scheduler.stop();

    expect(scan).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('Scheduled scan started');
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('logs scheduled scan failures', async () => {
    let onTick: (() => void) | undefined;
    const scheduleTask = jest.fn(((_expression, callback) => {
      onTick = callback;
      return { stop: jest.fn() };
    }) as CronSchedule);
    const logger = { info: jest.fn(), error: jest.fn() };
    startScheduler(
      { cron: '* * * * *', timezone: 'UTC' },
      jest.fn().mockRejectedValue(new Error('scan failed')),
      logger,
      scheduleTask,
    );

    onTick!();
    await Promise.resolve();

    expect(logger.error).toHaveBeenCalledWith(
      'Scheduled scan failed: scan failed',
    );
  });

  it('skips a scheduled execution while another scan is running', async () => {
    let onTick: (() => void) | undefined;
    let resolveScan: (() => void) | undefined;
    const scheduleTask = jest.fn(((_expression, callback) => {
      onTick = callback;
      return { stop: jest.fn() };
    }) as CronSchedule);
    const scan = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveScan = resolve;
        }),
    );
    const logger = { info: jest.fn(), error: jest.fn() };
    startScheduler(
      { cron: '* * * * *', timezone: 'UTC' },
      scan,
      logger,
      scheduleTask,
    );

    onTick!();
    onTick!();

    expect(scan).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      'Scheduled scan skipped because a scan is already running',
    );
    resolveScan!();
    await Promise.resolve();
  });
});
