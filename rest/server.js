// REST API with Express. Run: npm run start:rest  (http://localhost:3000)
const express = require('express');
const { createDb } = require('../data');

// A factory function (instead of a global app) makes the server easy to test:
// each test can create its own app with its own fresh database.
function createApp(db = createDb()) {
  const app = express();
  app.use(express.json());

  const findUser = (id) => db.users.find((u) => u.id === Number(id));

  // READ all users
  app.get('/users', (req, res) => {
    res.json(db.users);
  });

  // READ one user (404 if it does not exist)
  app.get('/users/:id', (req, res) => {
    const user = findUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  });

  // READ the posts of one user
  app.get('/users/:id/posts', (req, res) => {
    if (!findUser(req.params.id)) return res.status(404).json({ error: 'User not found' });
    res.json(db.posts.filter((p) => p.userId === Number(req.params.id)));
  });

  // CREATE a user (400 if the input is invalid, 201 when created)
  app.post('/users', (req, res) => {
    const { name, email, age } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }
    const user = { id: db.nextUserId++, name, email, age };
    db.users.push(user);
    res.status(201).json(user);
  });

  // UPDATE a user
  app.put('/users/:id', (req, res) => {
    const user = findUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    Object.assign(user, req.body);
    res.json(user);
  });

  // DELETE a user (204 = success, no body)
  app.delete('/users/:id', (req, res) => {
    const index = db.users.findIndex((u) => u.id === Number(req.params.id));
    if (index === -1) return res.status(404).json({ error: 'User not found' });
    db.users.splice(index, 1);
    res.sendStatus(204);
  });

  // Malformed JSON body (and other errors) -> JSON error instead of an HTML page
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message });
  });

  return app;
}

module.exports = { createApp };

// Only start listening when this file is run directly (not when imported by tests)
if (require.main === module) {
  createApp().listen(3000, () => console.log('REST API ready at http://localhost:3000'));
}
