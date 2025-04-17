const express = require("express");
const multer = require("multer");
const fs = require("fs");
const uploadFileToS3 = require("./s3").uploadFileToS3;
const extractTextFromImage = require("./gptOCR");
const db = require("./db");
const { authenticateToken } = require('./auth');

// Configure multer
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

const router = express.Router();

module.exports = (io) => {
  // API Route to handle file upload and OCR processing
  router.post("/", authenticateToken, upload.single("file"), async (req, res) => {
    try {
      console.error('=== UPLOAD REQUEST START ===');
      console.error('Upload request received');
      console.error('Request user object:', req.user);
      
      // Ensure we have a valid user ID
      if (!req.user || !req.user.userId) {
        console.error('❌ No valid user ID in request');
        console.error('req.user:', req.user);
        console.error('req.headers:', req.headers);
        return res.status(401).json({ message: "No valid user ID found" });
      }
      const userId = req.user.userId;
      console.error('✅ User ID from request:', userId);

      // Check if file exists
      if (!req.file) {
        console.error('❌ No file uploaded');
        return res.status(400).json({ message: "No file uploaded" });
      }

      const file = req.file;
      const imageName = req.body.documentName || file.originalname;

      console.error('Processing upload:');
      console.error('- User ID:', userId);
      console.error('- Document name:', imageName);
      console.error('- File type:', file.mimetype);

      // Validate file type
      if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
        return res.status(400).json({ message: "Invalid file type. Only images and PDFs are allowed." });
      }

      console.log("Upload started: Emitting upload-start event");
      // Notify frontend that upload has started
      io.emit("upload-progress", { progress: 0 });

      // Step 1: Upload file to S3 (asynchronous)
      const fileKey = await uploadFileToS3(file, userId, imageName);
      const s3Url = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;

      // Emit progress 50% once file is uploaded
      io.emit("upload-progress", { progress: 40 });

      // STEP 2: Text extraction (Progress from 40% to 70%)
      let textExtractionProgress = 40;
      const extractionInterval = setInterval(() => {
        if (textExtractionProgress < 70) {
          textExtractionProgress += 5;
          io.emit("upload-progress", { progress: textExtractionProgress });
        } else {
          clearInterval(extractionInterval);
          console.log("Text extraction complete (70%)");
        }
      }, 1250);

      // Step 2: Extract text using GPT-4 (synchronously after Step 2)
      const base64Image = file.buffer.toString("base64");
      const extractedStickers = await extractTextFromImage(base64Image);

      // STEP 3: After text extraction, emit progress 70%
      io.emit("upload-progress", { progress: 70 });

      // STEP 4: Insert stickers into the database (Progress from 70% to 95%)
      let dbInsertionProgress = 70;
      const dbInterval = setInterval(() => {
        if (dbInsertionProgress < 95) {
          dbInsertionProgress += 5;
          io.emit("upload-progress", { progress: dbInsertionProgress });
        } else {
          clearInterval(dbInterval);
          console.log("Database insertion almost complete (95%)");
        }
      }, 500);

      // Count occurrences of identical stickers (using only GTIN)
      const stickerMap = new Map();
      for (const sticker of extractedStickers) {
        const key = sticker.gtin; // Only use GTIN as the key
        stickerMap.set(key, (stickerMap.get(key) || 0) + 1);
      }

      // Step 4: Insert each sticker into the database
      for (const [gtin, quantity] of stickerMap.entries()) {
        // Find the first sticker with this GTIN to get its other properties
        const sticker = extractedStickers.find(s => s.gtin === gtin);
        
        // Log the values being inserted
        console.error('=== INSERTING STICKER ===');
        console.error('Values being inserted:', {
          imageName,
          brand: sticker.brand,
          product: sticker.product,
          dimensions: sticker.dimensions,
          gtin,
          ref: sticker.ref,
          lot: sticker.lot,
          quantity,
          userId,
          procedureDate: req.body.procedureDate,
          hospital: req.body.hospital,
          doctor: req.body.doctor,
          procedure: req.body.procedure,
          billingNo: req.body.billingNo,
          s3Url
        });
        
        await db.query(
          `INSERT INTO product_labels (
            image_name, brand, item, dimensions, gtin, ref, lot, quantity, user_id,
            procedure_date, hospital, doctor, procedure_name, billing_no, s3_image_url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            imageName, sticker.brand, sticker.product, sticker.dimensions, gtin, 
            sticker.ref, sticker.lot, quantity, userId,
            new Date(req.body.procedureDate), req.body.hospital, req.body.doctor, 
            req.body.procedure, req.body.billingNo, s3Url
          ]
        );
      }

      // Notify frontend that upload is complete (100% progress)
      setTimeout(() => {
        io.emit("upload-progress", { progress: 100 });
        io.emit("upload-complete", { message: "File upload and processing complete" });
      }, 700);

      res.json({
        message: "File processed and data stored",
        fileKey,
        extracted: extractedStickers,
      });
    } catch (error) {
      console.error("Error processing file:", error);
      res.status(500).json({
        message: "Error processing file",
        error: error.message,
      });

      // Emit error event if something goes wrong
      io.emit("upload-error", "Error processing the file");
    }
  });

  return router;
};

