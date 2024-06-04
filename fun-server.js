const fs = require("fs");
const fastify = require("fastify")({ logger: false });
const os = require("os");
const crypto = require("crypto");

// https://stackoverflow.com/questions/23327010/how-to-generate-unique-id-with-node-js
const getRandomIdHex = () => crypto.randomBytes(16).toString("hex");
const getRandomIdBase64 = () => crypto.randomBytes(16).toString("base64");
const getRandomIdUUID = () => crypto.randomUUID();

const Users = {
  users: [],
  addUser: function (data) {
    const match = this.validateUserAndIP(data.name, data.ip);
    if (match) {
      return match.id;
    } else {
      // const id = this.users.length + 1;
      const id = getRandomIdUUID();
      const newUser = { id, ...data };
      this.users.push(newUser);
      return id;
    }
  },
  validateUserAndIP: function (name, ip) {
    return this.users.find((user) => user.name === name && user.ip === ip);
  },
  validateUser: function (id) {
    return this.users.find((user) => user.id === id);
  },
};

const Messages = {
  messages: [],
  addMessage: function (data) {
    const { source, sourceName, destination, destinationName, message } = data;
    const id = getRandomIdUUID();
    const newMessage = { id, source, sourceName, destination, destinationName, message };
    this.messages.push(newMessage);
  },
  getMessages: function (destination) {
    const returnMessages = [];
    let index = -1;
    do {
      index = this.messages.findIndex(
        (message) => message.destination === destination
      );
      if (index >= 0) {
        returnMessages.push(this.messages[index]);
        this.messages.splice(index, 1);
      }
    } while (index !== -1);
    return returnMessages;
  },
};

// Function to get the local IP address
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
    const interfaceInfo = interfaces[interfaceName];
    for (const alias of interfaceInfo) {
      if (alias.family === "IPv4" && !alias.internal) {
        return alias.address;
      }
    }
  }
  return "127.0.0.1";
}

fastify.get("/", (request, reply) => {
  fs.readFile(`${__dirname}/index.html`, (err, data) => {
    if (err) {
      reply
        .code(500)
        .header("Content-Type", "text/html; charset=utf-8")
        .send("<h1>Server error.</h1>");
    } else {
      reply
        .code(200)
        .header("Content-Type", "text/html; charset=utf-8")
        .send(data);
    }
  });
});

fastify.get("/test", async (request, reply) => {
  const { ip } = request;
  const data = { ip };
  console.log(`Test connection from ${ip}`);
  // Return response
  reply
    .code(200)
    .header("Content-Type", "application/json;charset=utf-8")
    .send({ error: "", statusCode: 200, data });
});

fastify.post("/user/connect", async (request, reply) => {
  const { ip } = request;
  const { name = "" } = request.body;
  if (name.length === 0) {
    return reply
      .code(409)
      .header("Content-Type", "application/json;charset=utf-8")
      .send({ error: "Empty name not supported", statusCode: 409, data: {} });
  }
  const id = Users.addUser({ ip, name });
  const users = Users.users.map((user) => {
    return { name: user.name, id: user.id };
  });
  const data = { ip, name, users, id };
  console.log(
    `User ${name} (${id}) connected from ${ip} - total users: ${Users.users.length}`
  );
  // Return response
  reply
    .code(200)
    .header("Content-Type", "application/json;charset=utf-8")
    .send({ error: "", statusCode: 200, data });
});

fastify.get("/user/users", async (request, reply) => {
  const { ip } = request;
  const { name: source = "" } = request.query;
  const users = Users.users.map((user) => {
    return { name: user.name, id: user.id };
  });
  reply
    .code(200)
    .header("Content-Type", "application/json;charset=utf-8")
    .send({ error: "", statusCode: 200, data: { users } });
});

fastify.post("/user/message", async (request, reply) => {
  const { ip } = request;
  const { name = "" } = request.query;
  const { destination, message } = request.body;
  const sourceUser = Users.validateUserAndIP(name, ip);
  const destinationUser = Users.validateUser(destination);
  if (!sourceUser) {
    return reply
      .code(409)
      .header("Content-Type", "application/json;charset=utf-8")
      .send({
        error: "Invalid source (name and registered IP does not match)",
        statusCode: 409,
        data: {},
      });
  } else if (!destinationUser) {
    return reply
      .code(409)
      .header("Content-Type", "application/json;charset=utf-8")
      .send({
        error: "Invalid destination (name does not exist)",
        statusCode: 409,
        data: {},
      });
  } else {
    Messages.addMessage({
      source: sourceUser.id,
      sourceName: sourceUser.name,
      destination: destinationUser.id,
      destinationName: destinationUser.name,
      message,
    });
    const action = `Message sent from ${sourceUser.name} to ${destinationUser.name}`;
    console.log(`${action} - Total messages: ${Messages.messages.length}`);
    // Return response
    reply
      .code(200)
      .header("Content-Type", "application/json;charset=utf-8")
      .send({ error: "", statusCode: 200, data: { message, action } });
  }
});

fastify.get("/user/messages", async (request, reply) => {
  const { ip } = request;
  const { name = "" } = request.query;
  const user = Users.validateUserAndIP(name, ip);
  if (!user) {
    return reply
      .code(409)
      .header("Content-Type", "application/json;charset=utf-8")
      .send({
        error: "Invalid name (name and registered IP does not match)",
        statusCode: 409,
        data: {},
      });
  } else {
    const messages = Messages.getMessages(user.id);
    console.log(
      `${messages.length} messages retrieved for ${user.name} - Total messages: ${Messages.messages.length}`
    );
    // Return response
    reply
      .code(200)
      .header("Content-Type", "application/json;charset=utf-8")
      .send({ error: "", statusCode: 200, data: { messages } });
  }
});

// Start the server
const port = 8080;
const host = getLocalIpAddress();
fastify.listen({ port, host }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  // fastify.log.info(`Server listening on ${address}:${port}`);
  console.log(`Server listening on ${address}`);
});
