import 'dotenv/config';

import { parseCliArgs } from './cli';
import { createApplication } from './app';
import { registerGracefulShutdown } from './shutdown';

export async function main(
  args = process.argv.slice(2),
  logger: Pick<Console, 'error' | 'info'> = console,
): Promise<void> {
  const options = parseCliArgs(args);

  const application = createApplication(options.configPath, { logger });

  if (options.scan) {
    logger.info('Manual scan mode starting');
    try {
      await application.runScan();
    } finally {
      application.close();
    }
    return;
  }

  registerGracefulShutdown(application, process, logger);
  application.startScheduled();
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
