import cron, { type TaskOptions } from 'node-cron';

import type { ScheduleConfig } from './config';

export interface CronTask {
  stop(): void;
}

export interface SchedulerLogger {
  info(message: string): void;
  error(message: string): void;
}

export type CronSchedule = (
  expression: string,
  onTick: () => void,
  options: TaskOptions,
) => CronTask;

export interface ScanScheduler {
  stop(): void;
}

export function startScheduler(
  schedule: ScheduleConfig,
  scan: () => Promise<void>,
  logger: SchedulerLogger = console,
  scheduleTask: CronSchedule = cron.schedule,
): ScanScheduler {
  let scanRunning = false;
  const task = scheduleTask(
    schedule.cron,
    () => {
      if (scanRunning) {
        logger.info('Scheduled scan skipped because a scan is already running');
        return;
      }

      scanRunning = true;
      logger.info('Scheduled scan started');
      void scan()
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          logger.error(`Scheduled scan failed: ${message}`);
        })
        .finally(() => {
          scanRunning = false;
        });
    },
    { timezone: schedule.timezone },
  );

  return {
    stop: () => task.stop(),
  };
}

export const scheduleScans = startScheduler;
