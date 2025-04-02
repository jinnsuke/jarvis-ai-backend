require("dotenv").config(); // Load environment variables
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const db = require("./db");  // Import the db object from db.js


// Import file upload and Textract functions
const { uploadFileToS3 } = require("./s3");
// const { analyzeDocument } = require("./textract");
const uploadHandler = require("./uploadHandler"); // Import handler

const app = express();
app.use(express.json());
app.use(cors()); // Allow frontend to call API

// API Route for File Upload & Processing
app.use("/api", uploadHandler); // Connect the /upload route from uploadHandler.js

// API Route for Document Retrieval
app.get("/api/document/:imageName", async (req, res) => {
  const { imageName } = req.params;
  try {
    // Query the database using the image_name to get extracted data
    const result = await db.query("SELECT * FROM product_labels WHERE image_name = $1", [imageName]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Document not found" });
    }
    
    // Send all rows as an array of documents
    res.json(result.rows);  // Return the entire rows array
  } catch (error) {
    console.error("Error fetching document:", error);
    res.status(500).json({ message: "Error fetching document", error: error.message });
  }
});

// Serve Frontend (Only in Production)
const FRONTEND_PATH = path.join(__dirname, "../frontend/dist");
app.use(express.static(FRONTEND_PATH));  // Serving frontend assets

// Catch-all route to serve index.html for frontend requests
app.get("*", (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "index.html"));
});


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
