// Automated tests for the REST API using Jest + Supertest.
// Supertest calls the Express app directly, so no port and no running server are needed.
const request = require('supertest');
const { createApp } = require('../rest/server');

describe('REST API', () => {
  let app;
  beforeEach(() => {
    app = createApp(); // fresh database for every test
  });

  describe('GET /users', () => {
    test('returns all users with 200', async () => {
      const res = await request(app).get('/users');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('GET /users/:id', () => {
    test('returns the user with 200', async () => {
      const res = await request(app).get('/users/1');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 1, name: 'Somchai' });
    });

    test('over-fetching: returns fields we may not need (email, age)', async () => {
      const res = await request(app).get('/users/1');
      expect(Object.keys(res.body).sort()).toEqual(['age', 'email', 'id', 'name']);
    });

    test('returns 404 when the user does not exist', async () => {
      const res = await request(app).get('/users/999');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'User not found' });
    });
  });

  describe('GET /users/:id/posts', () => {
    test('returns the posts of that user', async () => {
      const res = await request(app).get('/users/1/posts');
      expect(res.status).toBe(200);
      expect(res.body.map((p) => p.title)).toEqual(['Learning REST', 'Learning GraphQL']);
    });

    test('under-fetching: needs a 2nd request to get the posts', async () => {
      const user = await request(app).get('/users/1');
      expect(user.body.posts).toBeUndefined(); // the user response has no posts
    });

    test('returns 404 for an unknown user', async () => {
      const res = await request(app).get('/users/999/posts');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /users', () => {
    test('creates a user and returns 201', async () => {
      const res = await request(app).post('/users').send({ name: 'Somsri', email: 'somsri@example.com' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ id: 3, name: 'Somsri' });

      // verify the side effect: the user can now be read back
      const check = await request(app).get('/users/3');
      expect(check.status).toBe(200);
    });

    test('returns 400 when name or email is missing', async () => {
      const res = await request(app).post('/users').send({ name: 'No Email' });
      expect(res.status).toBe(400);
    });

    test('returns 400 for malformed JSON', async () => {
      const res = await request(app).post('/users').set('Content-Type', 'application/json').send('{ bad json');
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /users/:id', () => {
    test('updates the user', async () => {
      const res = await request(app).put('/users/1').send({ name: 'Somchai Updated' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Somchai Updated');
    });

    test('returns 404 for an unknown user', async () => {
      const res = await request(app).put('/users/999').send({ name: 'X' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /users/:id', () => {
    test('deletes the user (204) and then it is gone (404)', async () => {
      const del = await request(app).delete('/users/1');
      expect(del.status).toBe(204);

      const get = await request(app).get('/users/1');
      expect(get.status).toBe(404);
    });
  });
});
