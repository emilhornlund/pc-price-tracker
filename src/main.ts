import { parseCliArgs } from './cli';
import { runManualScan } from './app';

export async function main(args = process.argv.slice(2)): Promise<void> {
  const options = parseCliArgs(args);

  if (!options.scan) {
    console.log('No command selected. Use --scan to run an immediate scan.');
    return;
  }

  await runManualScan(options.configPath);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
