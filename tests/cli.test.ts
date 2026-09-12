import { parseCliArgs } from '../src/cli';

describe('parseCliArgs', () => {
  it('recognizes manual scan mode and an explicit config path', () => {
    expect(parseCliArgs(['--scan', '--config', '/tmp/config.yaml'])).toEqual({
      scan: true,
      configPath: '/tmp/config.yaml',
    });
  });

  it('returns no command when no mode is selected', () => {
    expect(parseCliArgs([])).toEqual({ scan: false });
  });

  it('rejects unknown arguments and missing config paths', () => {
    expect(() => parseCliArgs(['--unknown'])).toThrow('Unknown command-line');
    expect(() => parseCliArgs(['--config'])).toThrow(
      '--config requires a file path',
    );
  });
});
