// Likes over real HTTP (`pnpm backend test:int`), one describe per acceptance
// criterion of .plans/quack-likes/user-story.md. The whole app runs against
// the rebuilt test database, so "at most once" is checked against the real
// constraint and real concurrent requests, not a mocked repository
// (docs/adr/002-likes.md).
import { INestApplication } from '@nestjs/common';
import {
  anonymous,
  createTestApp,
  resetDatabase,
  signedUp,
} from '@test/int/test-app';
import TestAgent from 'supertest/lib/agent';

type QuackJson = {
  id: string;
  deleted: boolean;
  likeCount: number;
  likedByMe: boolean;
};

describe('Likes: PUT / DELETE /api/quacks/:id/like', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  beforeEach(() => resetDatabase(app));

  const postQuack = async (agent: TestAgent, text: string): Promise<string> => {
    const response = await agent.post('/api/quacks').send({ text }).expect(201);
    return (response.body as QuackJson).id;
  };

  const postReply = async (
    agent: TestAgent,
    parentId: string,
    text: string,
  ): Promise<string> => {
    const response = await agent
      .post(`/api/quacks/${parentId}/replies`)
      .send({ text })
      .expect(201);
    return (response.body as QuackJson).id;
  };

  // The quack as `agent` sees it in a list (the feed unless `query` says
  // otherwise).
  const listed = async (
    agent: TestAgent,
    id: string,
    query = '',
  ): Promise<QuackJson | undefined> => {
    const response = await agent.get(`/api/quacks${query}`).expect(200);
    return (response.body as QuackJson[]).find((quack) => quack.id === id);
  };

  describe('Scenario 1: liking a quack', () => {
    it('counts the like and answers with the quack as liked by me', async () => {
      const duck = await signedUp(app, 'duck');
      const goose = await signedUp(app, 'goose');
      const id = await postQuack(duck, 'Bread is overrated');

      const response = await goose.put(`/api/quacks/${id}/like`).expect(200);

      expect(response.body).toMatchObject({
        id,
        likeCount: 1,
        likedByMe: true,
      });
    });

    it('keeps the like for later reads, for the liker and for everyone else', async () => {
      const duck = await signedUp(app, 'duck');
      const goose = await signedUp(app, 'goose');
      const id = await postQuack(duck, 'Bread is overrated');
      await goose.put(`/api/quacks/${id}/like`).expect(200);

      // what a reload or another browser would read
      expect(await listed(goose, id)).toMatchObject({
        likeCount: 1,
        likedByMe: true,
      });
      expect(await listed(duck, id)).toMatchObject({
        likeCount: 1,
        likedByMe: false,
      });
    });
  });

  describe('Scenario 2: taking the like back', () => {
    it('removes the like and answers with the quack as not liked by me', async () => {
      const duck = await signedUp(app, 'duck');
      const goose = await signedUp(app, 'goose');
      const id = await postQuack(duck, 'Bread is overrated');
      await goose.put(`/api/quacks/${id}/like`).expect(200);

      const response = await goose.delete(`/api/quacks/${id}/like`).expect(200);

      expect(response.body).toMatchObject({
        id,
        likeCount: 0,
        likedByMe: false,
      });
      expect(await listed(goose, id)).toMatchObject({
        likeCount: 0,
        likedByMe: false,
      });
    });

    it('lets me like the quack again afterwards', async () => {
      const duck = await signedUp(app, 'duck');
      const goose = await signedUp(app, 'goose');
      const id = await postQuack(duck, 'Bread is overrated');
      await goose.put(`/api/quacks/${id}/like`).expect(200);
      await goose.delete(`/api/quacks/${id}/like`).expect(200);

      const response = await goose.put(`/api/quacks/${id}/like`).expect(200);

      expect(response.body).toMatchObject({ likeCount: 1, likedByMe: true });
    });

    it("takes back only my own like, never someone else's", async () => {
      const duck = await signedUp(app, 'duck');
      const goose = await signedUp(app, 'goose');
      const swan = await signedUp(app, 'swan');
      const id = await postQuack(duck, 'Bread is overrated');
      await goose.put(`/api/quacks/${id}/like`).expect(200);
      await swan.put(`/api/quacks/${id}/like`).expect(200);

      const response = await swan.delete(`/api/quacks/${id}/like`).expect(200);

      expect(response.body).toMatchObject({ likeCount: 1, likedByMe: false });
      expect(await listed(goose, id)).toMatchObject({
        likeCount: 1,
        likedByMe: true,
      });
    });
  });

  describe('Scenario 3: everyone likes a quack at most once', () => {
    it('counts a second like from the same person once', async () => {
      const duck = await signedUp(app, 'duck');
      const goose = await signedUp(app, 'goose');
      const id = await postQuack(duck, 'Bread is overrated');
      await goose.put(`/api/quacks/${id}/like`).expect(200);

      // a double click: the second request succeeds and changes nothing
      const response = await goose.put(`/api/quacks/${id}/like`).expect(200);

      expect(response.body).toMatchObject({ likeCount: 1, likedByMe: true });
    });

    it('counts likes sent at the same moment from two tabs once', async () => {
      const duck = await signedUp(app, 'duck');
      const goose = await signedUp(app, 'goose');
      const id = await postQuack(duck, 'Bread is overrated');

      const responses = await Promise.all(
        Array.from({ length: 5 }, () => goose.put(`/api/quacks/${id}/like`)),
      );

      expect(responses.map(({ status }) => status)).toEqual([
        200, 200, 200, 200, 200,
      ]);
      expect(await listed(duck, id)).toMatchObject({ likeCount: 1 });
    });

    it('treats taking back a like I never gave as nothing to do', async () => {
      const duck = await signedUp(app, 'duck');
      const goose = await signedUp(app, 'goose');
      const id = await postQuack(duck, 'Bread is overrated');

      const response = await goose.delete(`/api/quacks/${id}/like`).expect(200);

      expect(response.body).toMatchObject({ likeCount: 0, likedByMe: false });
    });

    it('never counts below zero when the like is taken back twice', async () => {
      const duck = await signedUp(app, 'duck');
      const goose = await signedUp(app, 'goose');
      const id = await postQuack(duck, 'Bread is overrated');
      await goose.put(`/api/quacks/${id}/like`).expect(200);
      await goose.delete(`/api/quacks/${id}/like`).expect(200);

      const response = await goose.delete(`/api/quacks/${id}/like`).expect(200);

      expect(response.body).toMatchObject({ likeCount: 0, likedByMe: false });
    });
  });

  describe('Scenario 4: everyone sees the same count', () => {
    it('shows two likes by others as 2, not liked by me, in the feed, a search and "Mine"', async () => {
      const duck = await signedUp(app, 'duck');
      const goose = await signedUp(app, 'goose');
      const swan = await signedUp(app, 'swan');
      const id = await postQuack(duck, 'Bread is overrated');
      await goose.put(`/api/quacks/${id}/like`).expect(200);
      await swan.put(`/api/quacks/${id}/like`).expect(200);

      const expected = { likeCount: 2, likedByMe: false };
      expect(await listed(duck, id)).toMatchObject(expected);
      expect(await listed(duck, id, '?search=overrated')).toMatchObject(
        expected,
      );
      expect(await listed(duck, id, '?author=me')).toMatchObject(expected);
    });

    it('shows a quack nobody liked as 0', async () => {
      const duck = await signedUp(app, 'duck');
      const id = await postQuack(duck, 'Nobody cares yet');

      expect(await listed(duck, id)).toMatchObject({
        likeCount: 0,
        likedByMe: false,
      });
    });

    it('counts each quack on its own', async () => {
      const duck = await signedUp(app, 'duck');
      const goose = await signedUp(app, 'goose');
      const liked = await postQuack(duck, 'Liked one');
      const other = await postQuack(duck, 'Other one');
      await goose.put(`/api/quacks/${liked}/like`).expect(200);

      expect(await listed(goose, liked)).toMatchObject({ likeCount: 1 });
      expect(await listed(goose, other)).toMatchObject({
        likeCount: 0,
        likedByMe: false,
      });
    });
  });

  describe('Scenario 5: replies and your own quacks', () => {
    it('lets the author like their own quack', async () => {
      const duck = await signedUp(app, 'duck');
      const id = await postQuack(duck, 'I like myself');

      const response = await duck.put(`/api/quacks/${id}/like`).expect(200);

      expect(response.body).toMatchObject({ likeCount: 1, likedByMe: true });
    });

    it('lets anyone like a reply, and the thread shows it', async () => {
      const duck = await signedUp(app, 'duck');
      const goose = await signedUp(app, 'goose');
      const id = await postQuack(duck, 'Who saw the heron?');
      const replyId = await postReply(goose, id, 'By the mill');

      const response = await duck
        .put(`/api/quacks/${replyId}/like`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: replyId,
        likeCount: 1,
        likedByMe: true,
      });
      const thread = await duck.get(`/api/quacks/${id}/replies`).expect(200);
      expect(thread.body).toEqual([
        expect.objectContaining({
          id: replyId,
          likeCount: 1,
          likedByMe: true,
        }),
      ]);
      // the like is on the reply, not on the quack it answers
      expect(await listed(duck, id)).toMatchObject({ likeCount: 0 });
    });
  });

  describe('Scenario 6: a deleted quack cannot be liked', () => {
    it('refuses to like or unlike a quack deleted meanwhile', async () => {
      const duck = await signedUp(app, 'duck');
      const goose = await signedUp(app, 'goose');
      const id = await postQuack(duck, 'Soon gone');
      await goose.put(`/api/quacks/${id}/like`).expect(200);
      await duck.delete(`/api/quacks/${id}`).expect(204);

      await goose.put(`/api/quacks/${id}/like`).expect(404);
      await goose.delete(`/api/quacks/${id}/like`).expect(404);
    });

    it('refuses to like or unlike a quack that never existed', async () => {
      const goose = await signedUp(app, 'goose');

      await goose.put('/api/quacks/no-such-quack/like').expect(404);
      await goose.delete('/api/quacks/no-such-quack/like').expect(404);
    });

    it("shows no likes on a deleted quack's placeholder, even ones it had", async () => {
      const duck = await signedUp(app, 'duck');
      const goose = await signedUp(app, 'goose');
      const id = await postQuack(duck, 'Soon gone');
      await postReply(goose, id, 'Keeps the placeholder alive');
      await goose.put(`/api/quacks/${id}/like`).expect(200);
      await duck.delete(`/api/quacks/${id}`).expect(204);

      expect(await listed(goose, id)).toMatchObject({
        deleted: true,
        likeCount: 0,
        likedByMe: false,
      });
      // and the placeholder takes no new likes either
      await goose.put(`/api/quacks/${id}/like`).expect(404);
    });
  });

  describe('Scenario 7: a visitor who is not signed in', () => {
    it('cannot like or take a like back', async () => {
      const duck = await signedUp(app, 'duck');
      const id = await postQuack(duck, 'Members only');

      await anonymous(app).put(`/api/quacks/${id}/like`).expect(401);
      await anonymous(app).delete(`/api/quacks/${id}/like`).expect(401);
      expect(await listed(duck, id)).toMatchObject({ likeCount: 0 });
    });
  });
});
