const express = require("express");
const multer = require("multer");
const { uploadFileToS3 } = require("./s3");
const { analyzeDocument } = require("./textract");
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const fileKey = await uploadFileToS3(req.file);
    const extractedText = await analyzeDocument(process.env.AWS_BUCKET_NAME, fileKey);

    res.json({
      message: "File processed successfully",
      text: extractedText,
    });
  } catch (error) {
    console.error("Error processing file:", error);
    res.status(500).json({
      message: "Error processing file",
      error: error.message,
    });
  }
});

module.exports = router; // Export the router for use in server.js
