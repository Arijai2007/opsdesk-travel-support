import { Pool } from 'pg';
// Durable single-host alternative for development without a Redis installation.
// Rate limits and revoked sessions survive API restarts. Production retains Redis.
export class PostgresCounterClient {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });
  async init() {
    await this.pool.query(
      'CREATE TABLE IF NOT EXISTS "OpsCounter" (key text PRIMARY KEY, value text NOT NULL, expires_at timestamptz)',
    );
  }
  async get(key: string): Promise<string | null> {
    const r = await this.pool.query<{ value: string }>(
      'SELECT value FROM "OpsCounter" WHERE key=$1 AND (expires_at IS NULL OR expires_at>now())',
      [key],
    );
    return r.rows[0]?.value || null;
  }
  async ttl(key: string): Promise<number> {
    const r = await this.pool.query<{ ttl: string | number }>(
      'SELECT CASE WHEN expires_at IS NULL THEN -1 ELSE GREATEST(0,ceil(extract(epoch FROM expires_at-now()))) END AS ttl FROM "OpsCounter" WHERE key=$1 AND (expires_at IS NULL OR expires_at>now())',
      [key],
    );
    return r.rows[0] ? Number(r.rows[0].ttl) : -2;
  }
  async incr(key: string): Promise<number> {
    const r = await this.pool.query<{ value: string }>(
      `INSERT INTO "OpsCounter" (key,value) VALUES ($1,'1') ON CONFLICT (key) DO UPDATE SET value=CASE WHEN "OpsCounter".expires_at<=now() THEN '1' ELSE (("OpsCounter".value::integer)+1)::text END, expires_at=CASE WHEN "OpsCounter".expires_at<=now() THEN NULL ELSE "OpsCounter".expires_at END RETURNING value`,
      [key],
    );
    return Number(r.rows[0].value);
  }
  async expire(key: string, seconds: number): Promise<number> {
    const r = await this.pool.query(
      'UPDATE "OpsCounter" SET expires_at=now()+($2*interval \'1 second\') WHERE key=$1',
      [key, seconds],
    );
    return r.rowCount || 0;
  }
  async del(key: string): Promise<number> {
    return (
      (await this.pool.query('DELETE FROM "OpsCounter" WHERE key=$1', [key]))
        .rowCount || 0
    );
  }
  async exists(key: string): Promise<number> {
    return (await this.get(key)) === null ? 0 : 1;
  }
  async set(
    key: string,
    value: string,
    _mode: 'EX',
    seconds: number,
  ): Promise<string> {
    await this.pool.query(
      'INSERT INTO "OpsCounter" (key,value,expires_at) VALUES ($1,$2,now()+($3*interval \'1 second\')) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, expires_at=EXCLUDED.expires_at',
      [key, value, seconds],
    );
    return 'OK';
  }
  async quit(): Promise<string> {
    await this.pool.end();
    return 'OK';
  }
}
