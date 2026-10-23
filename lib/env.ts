/** Fails loudly (at request time, not build time) when a required env var is missing. */
export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}. See .env.example.`);
  return value;
}
