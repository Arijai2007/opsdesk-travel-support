import { validateEnvironment } from './production-environment';
const valid = () => ({
  NODE_ENV: 'production',
  JWT_SECRET: 'a'.repeat(64),
  JWT_REFRESH_SECRET: 'b'.repeat(64),
  FRONTEND_URL: 'https://support.example.org',
  DATABASE_URL: 'postgresql://user:private@db.internal/opsdesk',
  REDIS_URL: 'rediss://user:private@cache.internal:6379',
  TURNSTILE_SECRET_KEY: 'configured-real-turnstile-key',
});
describe('production configuration validation', () => {
  it('rejects mistyped environment modes', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'Production' })).toThrow(
      'NODE_ENV',
    );
  });
  it('preserves local demo configuration', () => {
    const config = { NODE_ENV: 'development', OPSDESK_DEMO: 'true' };
    expect(validateEnvironment(config)).toBe(config);
  });
  it('accepts explicit production settings without changing secrets', () => {
    const config = valid();
    expect(validateEnvironment(config)).toBe(config);
  });
  for (const key of ['OPSDESK_DEMO', 'OPSDESK_LOCAL_COUNTERS'])
    it(`refuses ${key}`, () => {
      expect(() => validateEnvironment({ ...valid(), [key]: 'true' })).toThrow(
        key,
      );
    });
  for (const key of [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'DATABASE_URL',
    'REDIS_URL',
    'FRONTEND_URL',
    'TURNSTILE_SECRET_KEY',
  ])
    it(`requires ${key}`, () => {
      expect(() => validateEnvironment({ ...valid(), [key]: '' })).toThrow(key);
    });
  it('refuses identical signing secrets', () => {
    const config = valid();
    config.JWT_REFRESH_SECRET = config.JWT_SECRET;
    expect(() => validateEnvironment(config)).toThrow('must differ');
  });
  it('refuses weak/example signing secrets', () => {
    expect(() =>
      validateEnvironment({ ...valid(), JWT_SECRET: 'your_secret_here' }),
    ).toThrow('JWT_SECRET');
  });
  for (const url of [
    'http://support.example.org',
    'https://support.example.org/path',
    'https://support.example.org?token=private',
    'https://user:private@support.example.org',
  ])
    it(`rejects invalid frontend origin ${url.split('?')[0]}`, () => {
      expect(() =>
        validateEnvironment({ ...valid(), FRONTEND_URL: url }),
      ).toThrow('FRONTEND_URL');
    });
  it('refuses Cloudflare development keys', () => {
    expect(() =>
      validateEnvironment({
        ...valid(),
        TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
      }),
    ).toThrow('TURNSTILE_SECRET_KEY');
  });
  it('never echoes invalid credentials in errors', () => {
    const config = {
      ...valid(),
      REDIS_URL: 'http://user:do-not-print@cache.internal',
    };
    try {
      validateEnvironment(config);
      throw new Error('Expected validation failure');
    } catch (error) {
      expect((error as Error).message).not.toContain('do-not-print');
    }
  });
});
