const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const app = express();

// * Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://task-managementhq.web.app",
      "https://task-managementhq.firebaseapp.com",
    ],
    credentials: true,
  })
);

// * Default Route
app.get("/", (req, res) => {
  res.send("Task Management Server is Up");
});

// * MongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@usermanagement.n4peacj.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // * Collections
    const tasksCollection = client.db("taskManagement").collection("tasks");
    const usersCollection = client.db("taskManagement").collection("users");

    // * JWT Related APIs
    // JWT API
    app.post("/api/jwt", (req, res) => {
      try {
        const user = req.body;
        const token = jwt.sign(user, process.env.JWT_SECRET, {
          expiresIn: "24h",
        });

        res
          .cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
            maxAge: 1000 * 60 * 60 * 24,
          })
          .send({ Action: "Token form Local", success: true, token });
      } catch (err) {
        res.send(err);
      }
    });

    // Log Out API
    app.post("/api/logout", (req, res) => {
      try {
        const user = req.body;
        res
          .clearCookie("token", { maxAge: 0 })
          .send({ Action: "Logout user", success: true });
      } catch (err) {
        res.send(err);
      }
    });

    // Token Verification
    const verifyToken = (req, res, next) => {
      const token = req?.cookies?.token;
      if (!token)
        return res.status(401).send({ message: "Unauthorized access" });
      jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
        if (error)
          return res.status(401).send({ message: "Unauthorized access" });
        req.user = decoded;
        next();
      });
    };

    // * User Related API
    app.post("/api/users", async (req, res) => {
      try {
        const user = req.body;
        // Check if user is exits
        const query = { email: user.email };
        const existingUser = await usersCollection.findOne(query);
        if (existingUser) {
          return res.send({
            message: "User already exists!",
            insertedId: null,
          });
        }
        const result = await usersCollection.insertOne(user);
        res.send(result);
      } catch (error) {
        res.send(error);
      }
    });

    // * Task Related API

    // Get User Single Task
    app.get("/api/tasks/:id", verifyToken, async (req, res) => {
      try {
        if (req.user.email !== req.query.email) {
          return res.status(403).send("Forbidden access");
        }
        const query = {
          _id: new ObjectId(req.params.id),
          "author.email": req.query.email,
        };
        const result = await tasksCollection.findOne(query);
        res.send(result);
      } catch (err) {
        res.send(err);
      }
    });

    // Get User Tasks
    app.get("/api/tasks", verifyToken, async (req, res) => {
      try {
        if (req.user.email !== req.query.email) {
          return res.status(403).send("Forbidden access");
        }

        const page = parseInt(req.query.page);
        const size = parseInt(req.query.size);
        const tasksCount = await tasksCollection.countDocuments({
          "author.email": req.query.email,
        });

        const result = await tasksCollection
          .find({ "author.email": req.query.email })
          .skip(page * size)
          .limit(size)
          .toArray();
        res.send({ tasks: result, tasksCount });
      } catch (err) {
        res.send(err);
      }
    });

    // Post User Tasks
    app.post("/api/tasks", verifyToken, async (req, res) => {
      try {
        if (req.user.email !== req.query.email) {
          return res.status(403).send("Forbidden access");
        }

        const task = req.body;
        const result = await tasksCollection.insertOne(task);
        res.send(result);
      } catch (error) {
        res.send(error);
      }
    });

    // Update User Tasks
    app.put("/api/tasks/:id", verifyToken, async (req, res) => {
      try {
        if (req.user.email !== req.query.email) {
          return res.status(403).send("Forbidden access");
        }

        const task = req.body;
        const options = {};
        const query = {
          _id: new ObjectId(req.params.id),
          "author.email": req.query.email,
        };
        const updatedTask = {
          $set: {
            ...task,
          },
        };
        const result = await tasksCollection.updateOne(
          query,
          updatedTask,
          options
        );
        res.send(result);
      } catch (error) {
        res.send(error);
      }
    });

    // Delete User Task
    app.delete("/api/tasks/:id", verifyToken, async (req, res) => {
      try {
        if (req.user.email !== req.query.email) {
          return res.status(403).send("Forbidden access");
        }

        const result = await tasksCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });
        res.send(result);
      } catch (error) {
        res.send(error);
      }
    });

    // * Stats Related API
    // Get User Task Stats
    app.get("/api/stats", verifyToken, async (req, res) => {
      try {
        if (req.user.email !== req.query.email) {
          return res.status(403).send("Forbidden access");
        }

        const todos = await tasksCollection.countDocuments({
          "author.email": req?.query?.email,
          status: "to-do",
        });
        const ongoing = await tasksCollection.countDocuments({
          "author.email": req?.query?.email,
          status: "ongoing",
        });
        const completed = await tasksCollection.countDocuments({
          "author.email": req?.query?.email,
          status: "completed",
        });

        const data = [
          ["Taks", "Count"],
          ["To-Do", todos],
          ["On Going", ongoing],
          ["Completed", completed],
        ];

        res.send(data);
      } catch (error) {
        res.send(error);
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

// * Listeners
app.listen(port, () => {
  console.log("Server is running on", port);
});
