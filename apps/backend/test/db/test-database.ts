// The database the *.db-spec.ts tests run against: on the same server, with
// the same credentials as the dev database, under its name plus "_test". A
// run drops and rebuilds it, so it must never be the database `pnpm dev`
// works with.

export const devDatabaseUrl = (): string => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Run `pnpm env:check` to create apps/backend/.env.',
    );
  }
  return url;
};

// Idempotent, so applying it to a URL that already points at the test
// database (an inherited environment) leaves it there.
export const testDatabaseUrl = (devUrl: string): string => {
  const url = new URL(devUrl);
  const name = url.pathname.slice(1);
  if (!name.endsWith('_test')) {
    url.pathname = `${name}_test`;
  }
  return url.toString();
};

export const databaseName = (url: string): string =>
  new URL(url).pathname.slice(1);
