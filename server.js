require("dotenv").config(); // Load environment variables
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");

// Import file upload and Textract functions
const { uploadFileToS3 } = require("./s3");
const { analyzeDocument } = require("./textract");
const uploadHandler = require("./uploadHandler"); // Import handler

const app = express();
app.use(express.json());
app.use(cors()); // Allow frontend to call API

// API Route for File Upload & Processing
app.use("/api", uploadHandler); // Connect the /upload route from uploadHandler.js

// Serve Frontend (Only in Production)
const FRONTEND_PATH = path.join(__dirname, "../frontend/dist");
app.use(express.static(FRONTEND_PATH));
app.get("*", (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "index.html"));
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
