require("dotenv").config();

const express = require("express");
const { nanoid } = require("nanoid");
const crypto = require("crypto");

const app = express();

const { MongoClient, ObjectId } = require("mongodb");

const clientPromise = MongoClient.connect(process.env.DB_URI, {
  useUnifiedTopology: true,
  maxPoolSize: 10,
});

app.use(async (req, res, next) => {
  try {
    const client = await clientPromise;
    req.db = client.db("timers");
    next();
  } catch (err) {
    next(err);
  }
});

app.use(express.json());
app.use(express.static("public"));

const auth = async (req, res, next) => {
  if (!req.query.sessionId) return next();

  const user = await findUserBySessionId(req.db, req.query.sessionId);

  req.user = user;
  req.sessionId = req.query.sessionId;

  next();
};

const setTimerDuration = (timer) => (timer.duration = timer.end - timer.start);
const setTimerProgress = (timer) => (timer.progress = Date.now() - timer.start);

const createPasswordHash = (password) => crypto.createHash("sha256").update(password).digest("hex");

const findUserByUsername = async (db, username) => db.collection("users").findOne({ username });

const findUserBySessionId = async (db, sessionId) => {
  const session = await db.collection("sessions").findOne(
    { sessionId },
    {
      projection: { userId: 1 },
    }
  );

  if (!session) return;

  return db.collection("users").findOne({ _id: ObjectId(session.userId) });
};

const createUser = async (db, username, password) =>
  await db.collection("users").insertOne({
    username,
    password,
  });

const createSession = async (db, userId) => {
  const sessionId = nanoid();

  await db.collection("sessions").insertOne({
    userId,
    sessionId,
  });

  return sessionId;
};

const deleteSession = async (db, sessionId) => await db.collection("sessions").deleteOne({ sessionId });

app.get("/api/timers", auth, async (req, res) => {
  if (req.sessionId && req.user) {
    const db = req.db;

    const userTimers = await db
      .collection("timers")
      .find({ userId: ObjectId(req.user._id) })
      .toArray();

    userTimers.forEach((timer) => {
      setTimerDuration(timer);
      setTimerProgress(timer);
    });

    return res.json(userTimers);
  }
});

app.post("/api/timers", auth, async (req, res) => {
  if (req.body && req.sessionId) {
    const db = req.db;

    const newTimer = await db.collection("timers").insertOne({
      start: Date.now(),
      end: null,
      description: req.body.description,
      isActive: true,
      userId: ObjectId(req.user._id),
    });

    return res.json({ id: newTimer.insertedId.toString(), description: req.body.description });
  }
});

app.post("/api/timers/:id/stop", auth, async (req, res) => {
  if (req.params.id && req.sessionId) {
    try {
      const db = req.db;

      const stoppedTimer = await db.collection("timers").updateOne(
        { _id: ObjectId(req.params.id) },
        {
          $set: {
            end: Date.now(),
            isActive: false,
          },
        },
        { returnOriginal: false }
      );

      if (stoppedTimer) {
        return res.sendStatus(204);
      }
    } catch (err) {
      return res.sendStatus(404);
    }
  }
});

app.post("/signup", async (req, res) => {
  const username = req.body.username;
  const password = createPasswordHash(req.body.password);
  const sameUser = await findUserByUsername(req.db, username);

  if (sameUser) return res.json({ error: "Such user already exists!" });

  await createUser(req.db, username, password);

  const user = await findUserByUsername(req.db, username);
  const sessionId = await createSession(req.db, user._id);

  return res.json({ sessionId });
});

app.post("/login", async (req, res) => {
  const username = req.body.username;
  const password = createPasswordHash(req.body.password);
  const user = await findUserByUsername(req.db, username);

  if (!user || user.password !== password) return res.json({ error: "Wrong username or password!" });

  const sessionId = await createSession(req.db, user._id);

  return res.json({ sessionId });
});

app.get("/logout", auth, async (req, res) => {
  if (!req.user) return res.json({});

  await deleteSession(req.db, req.sessionId);

  return res.sendStatus(204);
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`  Listening on http://localhost:${port}`);
});
