import type { Application } from './app';

export interface ShutdownTarget {
  once(signal: 'SIGTERM' | 'SIGINT', listener: () => void): unknown;
}

export function registerGracefulShutdown(
  application: Application,
  target: ShutdownTarget = process,
  logger: Pick<Console, 'info'> = console,
): () => void {
  let closed = false;
  const shutdown = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    logger.info('Graceful shutdown starting');
    application.close();
  };

  target.once('SIGTERM', shutdown);
  target.once('SIGINT', shutdown);
  return shutdown;
}
