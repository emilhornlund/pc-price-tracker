export interface CliOptions {
  scan: boolean;
  configPath?: string;
}

export function parseCliArgs(args: readonly string[]): CliOptions {
  let scan = false;
  let configPath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--scan') {
      scan = true;
      continue;
    }

    if (argument === '--config') {
      const next = args[index + 1];
      if (next === undefined || next.startsWith('--')) {
        throw new Error('--config requires a file path');
      }
      configPath = next;
      index += 1;
      continue;
    }

    throw new Error(`Unknown command-line argument: ${argument}`);
  }

  return { scan, ...(configPath === undefined ? {} : { configPath }) };
}
