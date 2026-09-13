import { registerGracefulShutdown } from '../src/shutdown';
import type { Application } from '../src/app';

describe('registerGracefulShutdown', () => {
  it('closes the application for SIGTERM and SIGINT only once', () => {
    const listeners = new Map<string, () => void>();
    const target = {
      once: jest.fn((signal: 'SIGTERM' | 'SIGINT', listener: () => void) => {
        listeners.set(signal, listener);
      }),
    };
    const application = {
      close: jest.fn(),
    } as unknown as Application;
    const logger = { info: jest.fn() };

    registerGracefulShutdown(application, target, logger);
    listeners.get('SIGTERM')!();
    listeners.get('SIGINT')!();

    expect(target.once).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(target.once).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(application.close).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('Graceful shutdown starting');
  });
});
