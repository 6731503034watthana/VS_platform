// GraphQL API with Apollo Server. Run: npm run start:graphql  (http://localhost:4000)
const { ApolloServer } = require('@apollo/server');
const { startStandaloneServer } = require('@apollo/server/standalone');
const { GraphQLError } = require('graphql');
const { createDb } = require('../data');

// Schema = the contract between client and server
const typeDefs = `#graphql
  type User {
    id: ID!
    name: String!
    email: String!
    age: Int
    posts: [Post!]!
  }

  type Post {
    id: ID!
    title: String!
  }

  type Query {
    users: [User!]!
    user(id: ID!): User
  }

  type Mutation {
    createUser(name: String!, email: String!, age: Int): User!
    updateUser(id: ID!, name: String, email: String, age: Int): User
    deleteUser(id: ID!): Boolean!
  }
`;

// Resolvers = functions that fetch the data for each field
function createResolvers(db) {
  const findUser = (id) => db.users.find((u) => u.id === Number(id));

  return {
    Query: {
      users: () => db.users,
      user: (_, { id }) => findUser(id) || null, // not found -> null (no error)
    },
    // Runs only if the client asks for "posts"
    User: {
      posts: (user) => db.posts.filter((p) => p.userId === user.id),
    },
    Mutation: {
      createUser: (_, { name, email, age }) => {
        if (!name.trim() || !email.trim()) {
          throw new GraphQLError('name and email must not be empty', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
        const user = { id: db.nextUserId++, name, email, age };
        db.users.push(user);
        return user;
      },
      updateUser: (_, { id, ...changes }) => {
        const user = findUser(id);
        if (!user) return null;
        Object.assign(user, changes);
        return user;
      },
      deleteUser: (_, { id }) => {
        const index = db.users.findIndex((u) => u.id === Number(id));
        if (index === -1) return false;
        db.users.splice(index, 1);
        return true;
      },
    },
  };
}

// Factory so tests can build a server with a fresh database
function createServer(db = createDb()) {
  return new ApolloServer({ typeDefs, resolvers: createResolvers(db) });
}

module.exports = { typeDefs, createResolvers, createServer, startStandaloneServer };

if (require.main === module) {
  startStandaloneServer(createServer(), { listen: { port: 4000 } }).then(({ url }) =>
    console.log(`GraphQL API ready at ${url}`)
  );
}
