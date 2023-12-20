const express = require("express");
const cors = require("cors");
require("dotenv").config;
const port = process.env.PORT || 5000;
const app = express();

// * Middleware
app.use(express.json());
app.use(cors());

// * Default Route
app.get("/", (req, res) => {
  res.send("Task Management Server is Up");
});

// * Listeners
app.listen(port, () => {
  console.log("Server is running on", port);
});
