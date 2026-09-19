// Automated tests for the GraphQL API.
// Part 1 (fast): executeOperation runs a query straight against the server, no HTTP.
// Part 2 (end-to-end): start a real HTTP server and send a real POST request.
const { createServer, startStandaloneServer } = require('../graphql/server');

// Small helper: run a query and return { data, errors }
async function run(server, query, variables) {
  const res = await server.executeOperation({ query, variables });
  expect(res.body.kind).toBe('single');
  return res.body.singleResult;
}

describe('GraphQL API (executeOperation)', () => {
  let server;
  beforeEach(() => {
    server = createServer(); // fresh database for every test
  });

  describe('queries', () => {
    test('returns exactly the fields we ask for (no over-fetching)', async () => {
      const { data, errors } = await run(server, `{ user(id: "1") { name } }`);
      expect(errors).toBeUndefined();
      expect(data).toEqual({ user: { name: 'Somchai' } }); // no email, no age
    });

    test('returns a user AND their posts in ONE request (no under-fetching)', async () => {
      const { data } = await run(server, `{ user(id: "1") { name posts { title } } }`);
      expect(data).toEqual({
        user: {
          name: 'Somchai',
          posts: [{ title: 'Learning REST' }, { title: 'Learning GraphQL' }],
        },
      });
    });

    test('supports variables', async () => {
      const query = `query GetUser($id: ID!) { user(id: $id) { name } }`;
      const { data } = await run(server, query, { id: '2' });
      expect(data.user.name).toBe('Somying');
    });

    test('returns null (not an error) when the user does not exist', async () => {
      const { data, errors } = await run(server, `{ user(id: "999") { name } }`);
      expect(errors).toBeUndefined();
      expect(data.user).toBeNull();
    });

    test('lists all users', async () => {
      const { data } = await run(server, `{ users { id name } }`);
      expect(data.users).toHaveLength(2);
    });
  });

  describe('errors', () => {
    test('asking for a field that is not in the schema fails validation', async () => {
      const { errors } = await run(server, `{ user(id: "1") { nickname } }`);
      expect(errors).toHaveLength(1);
      expect(errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED');
    });

    test('a missing required argument fails validation', async () => {
      const { errors } = await run(server, `{ user { name } }`);
      expect(errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED');
    });
  });

  describe('mutations', () => {
    test('createUser creates a user that can be queried afterwards', async () => {
      const mutation = `mutation($name: String!, $email: String!) {
        createUser(name: $name, email: $email) { id name }
      }`;
      const created = await run(server, mutation, { name: 'Somsri', email: 'somsri@example.com' });
      expect(created.data.createUser).toEqual({ id: '3', name: 'Somsri' });

      const list = await run(server, `{ users { name } }`);
      expect(list.data.users.map((u) => u.name)).toContain('Somsri');
    });

    test('createUser with an empty name returns a BAD_USER_INPUT error', async () => {
      const { data, errors } = await run(
        server,
        `mutation { createUser(name: " ", email: "a@b.com") { id } }`
      );
      expect(data).toBeNull();
      expect(errors[0].extensions.code).toBe('BAD_USER_INPUT');
    });

    test('updateUser changes the user', async () => {
      const { data } = await run(server, `mutation { updateUser(id: "1", name: "New Name") { name } }`);
      expect(data.updateUser.name).toBe('New Name');
    });

    test('deleteUser removes the user', async () => {
      const del = await run(server, `mutation { deleteUser(id: "1") }`);
      expect(del.data.deleteUser).toBe(true);

      const check = await run(server, `{ user(id: "1") { name } }`);
      expect(check.data.user).toBeNull();
    });
  });
});

describe('GraphQL API (real HTTP request)', () => {
  let server, url;
  beforeAll(async () => {
    server = createServer();
    ({ url } = await startStandaloneServer(server, { listen: { port: 0 } })); // port 0 = any free port
  });
  afterAll(async () => {
    await server.stop();
  });

  const post = (body) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  test('POST /graphql returns 200 and the requested data', async () => {
    const res = await post({ query: `{ user(id: "1") { name posts { title } } }` });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.user.name).toBe('Somchai');
    expect(json.data.user.posts).toHaveLength(2);
  });

  test('a resolver error still returns HTTP 200, with an "errors" array in the body', async () => {
    const res = await post({ query: `mutation { createUser(name: " ", email: "a@b.com") { id } }` });
    expect(res.status).toBe(200); // <-- unlike REST, the status code is NOT 4xx
    const json = await res.json();
    expect(json.errors[0].extensions.code).toBe('BAD_USER_INPUT');
  });

  test('a query that fails validation (unknown field) returns HTTP 400 in Apollo Server', async () => {
    const res = await post({ query: `{ user(id: "1") { nickname } }` });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED');
  });
});
