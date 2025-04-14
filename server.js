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
const XLSX = require('xlsx');

// Import file upload and Textract functions
const { uploadFileToS3 } = require("./s3");
// const { analyzeDocument } = require("./textract");
const uploadHandler = require("./uploadHandler"); // Import handler

const app = express();
const server = http.createServer(app);

// Initialize socket.io with CORS configuration
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:8080", "http://localhost:3000"],
    methods: ["GET", "POST", "PUT"],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  }
});

app.use(express.json());
app.use(cors({
  origin: ["http://localhost:8080", "http://localhost:3000"],
  methods: ["GET", "POST", "PUT"],
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

// Update sticker quantity
app.put("/api/document/:name/sticker/:gtin/quantity", authenticateToken, async (req, res) => {
  const { name, gtin } = req.params;
  const { quantity } = req.body;
  
  if (!quantity || isNaN(quantity) || quantity < 1) {
    return res.status(400).json({ message: "Invalid quantity value" });
  }

  try {
    const result = await db.query(
      `UPDATE product_labels 
       SET quantity = $1 
       WHERE image_name = $2 AND gtin = $3 AND user_id = $4
       RETURNING *`,
      [quantity, name, gtin, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Sticker not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating sticker quantity:", error);
    res.status(500).json({ message: "Error updating quantity", error: error.message });
  }
});

// Export data endpoint
app.post("/api/export", authenticateToken, async (req, res) => {
  const { startDate, endDate } = req.body;
  const userId = req.user.userId;

  try {
    // Query the database for all data, with optional date range
    let query = `SELECT * FROM product_labels WHERE user_id = $1`;
    let params = [userId];

    if (startDate && endDate) {
      query += ` AND procedure_date BETWEEN $2 AND $3`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY procedure_date ASC NULLS LAST`;
    
    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No data found" });
    }

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(result.rows);

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, "Extracted Data");

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=extracted_data.xlsx');
    
    // Send the file
    res.send(buffer);
  } catch (error) {
    console.error("Error exporting data:", error);
    res.status(500).json({ message: "Error exporting data", error: error.message });
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
