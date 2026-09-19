// In-memory "database". createDb() returns a FRESH copy every time,
// so each test can start from a clean state (test isolation).
function createDb() {
  return {
    users: [
      { id: 1, name: 'Somchai', email: 'somchai@example.com', age: 28 },
      { id: 2, name: 'Somying', email: 'somying@example.com', age: 31 },
    ],
    posts: [
      { id: 1, userId: 1, title: 'Learning REST' },
      { id: 2, userId: 1, title: 'Learning GraphQL' },
      { id: 3, userId: 2, title: 'Testing APIs' },
    ],
    nextUserId: 3,
  };
}

module.exports = { createDb };
