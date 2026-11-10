/** Reject demo configuration before Nest creates database/Redis connections. */
export function validateEnvironment(config: Record<string, unknown>) {
  if (
    config.NODE_ENV !== undefined &&
    (typeof config.NODE_ENV !== 'string' ||
      !['development', 'test', 'production'].includes(config.NODE_ENV))
  )
    throw new Error('NODE_ENV must be development, test or production.');
  if (config.NODE_ENV !== 'production') return config;
  const required = (name: string) => {
    const value = config[name];
    if (typeof value !== 'string' || !value.trim())
      throw new Error(`${name} is required in production.`);
    return value;
  };
  for (const name of ['OPSDESK_DEMO', 'OPSDESK_LOCAL_COUNTERS']) {
    const flag = config[name];
    if (
      flag === true ||
      (typeof flag === 'string' && flag.trim().toLowerCase() === 'true')
    )
      throw new Error(`${name} must be disabled in production.`);
  }
  for (const name of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const value = required(name);
    if (
      value.length < 32 ||
      /your_|change.?me|placeholder|example/i.test(value)
    )
      throw new Error(
        `${name} must be a unique generated secret of at least 32 characters.`,
      );
  }
  if (config.JWT_SECRET === config.JWT_REFRESH_SECRET)
    throw new Error('JWT access and refresh secrets must differ.');
  const frontend = required('FRONTEND_URL');
  let origin: URL;
  try {
    origin = new URL(frontend);
  } catch {
    throw new Error('FRONTEND_URL must be an HTTPS origin.');
  }
  if (
    origin.protocol !== 'https:' ||
    origin.origin !== frontend ||
    origin.username ||
    origin.password
  )
    throw new Error(
      'FRONTEND_URL must be an HTTPS origin without credentials, path, query or fragment.',
    );
  for (const [name, protocols] of [
    ['DATABASE_URL', ['postgres:', 'postgresql:']],
    ['REDIS_URL', ['redis:', 'rediss:']],
  ] as const) {
    let url: URL;
    try {
      url = new URL(required(name));
    } catch {
      throw new Error(`${name} must be a valid connection URL.`);
    }
    if (
      !url.hostname ||
      !(protocols as readonly string[]).includes(url.protocol)
    )
      throw new Error(`${name} has an unsupported connection scheme.`);
  }
  const turnstile = required('TURNSTILE_SECRET_KEY');
  if (
    /^[123]x0{20,}AA$/.test(turnstile) ||
    /your_|placeholder/i.test(turnstile)
  )
    throw new Error('TURNSTILE_SECRET_KEY must not be a development test key.');
  return config;
}
