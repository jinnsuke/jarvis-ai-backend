require("dotenv").config(); // Load environment variables
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const http = require("http");
const socketIo = require("socket.io");
const db = require("./db");  // Import the db object from db.js
const { authenticateToken } = require('./auth');
const authRoutes = require('./authRoutes');

// Import file upload and Textract functions
const { uploadFileToS3 } = require("./s3");
// const { analyzeDocument } = require("./textract");
const uploadHandler = require("./uploadHandler"); // Import handler

const app = express();
const server = http.createServer(app);

// Initialize socket.io with CORS configuration
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:8080",
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  }
});

app.use(express.json());
app.use(cors({
  origin: "http://localhost:8080",
  methods: ["GET", "POST"],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Auth routes (unprotected)
app.use('/api/auth', authRoutes);

// Protected routes
app.use("/api/upload", authenticateToken, uploadHandler(io));

// Protected document retrieval route
app.get("/api/document/:name", authenticateToken, async (req, res) => {
  const { name } = req.params;
  try {
    const result = await db.query(
      "SELECT * FROM product_labels WHERE image_name = $1 AND user_id = $2",
      [name, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Document not found" });
    }

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching document:", error);
    res.status(500).json({ message: "Error fetching document", error: error.message });
  }
});

// Get user's gallery
app.get("/api/gallery", authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT DISTINCT image_name FROM product_labels WHERE user_id = $1",
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching gallery:", error);
    res.status(500).json({ message: "Error fetching gallery", error: error.message });
  }
});

// Serve frontend (only in production)
const FRONTEND_PATH = path.join(__dirname, "../frontend/dist");
app.use(express.static(FRONTEND_PATH)); // Serving frontend assets

// Catch-all route to serve index.html for frontend requests
app.get("*", (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "index.html"));
});

// Start the server with Socket.IO listening for progress updates
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
