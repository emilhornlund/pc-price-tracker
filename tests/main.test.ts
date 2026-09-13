import type { Application } from '../src/app';
import { createApplication } from '../src/app';
import { main } from '../src/main';

jest.mock('../src/app', () => ({
  createApplication: jest.fn(),
}));

describe('main', () => {
  it('identifies a one-off scan when manual mode is selected', async () => {
    const application = {
      runScan: jest.fn().mockResolvedValue(undefined),
      close: jest.fn(),
    } as unknown as Application;
    const logger = { info: jest.fn(), error: jest.fn() };
    jest.mocked(createApplication).mockReturnValue(application);

    await main(['--scan'], logger);

    expect(logger.info).toHaveBeenCalledWith('Manual scan mode starting');
    expect(application.runScan).toHaveBeenCalledTimes(1);
    expect(application.close).toHaveBeenCalledTimes(1);
  });
});
