// The quack endpoints over real HTTP (`pnpm backend test:int`): the whole app,
// BetterAuth's session cookie and the guard included, against a real Postgres.
// What the mocked unit tests can't show is whether the pieces are wired
// together — that the guard really sits in front of the route and really
// recognises the cookie BetterAuth hands out.
import { INestApplication } from '@nestjs/common';
import {
  anonymous,
  createTestApp,
  resetDatabase,
  signedUp,
} from '@test/int/test-app';

describe('GET /api/quacks', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  beforeEach(() => resetDatabase(app));

  it('turns away a visitor who is not signed in', async () => {
    await anonymous(app).get('/api/quacks').expect(401);
  });

  it('lists the quacks for a signed-in user', async () => {
    const duck = await signedUp(app, 'duck');
    // Written through the API too, so the list has something to prove the
    // database behind it is a real one, and empty before this test.
    await duck.post('/api/quacks').send({ text: 'First quack' }).expect(201);

    const response = await duck.get('/api/quacks').expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({ text: 'First quack' }),
    ]);
  });
});
