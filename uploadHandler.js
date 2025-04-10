const express = require("express");
const multer = require("multer");
const fs = require("fs");
const uploadFileToS3 = require("./s3").uploadFileToS3;
const extractTextFromImage = require("./gptOCR");
const db = require("./db");

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
  router.post("/", upload.single("file"), async (req, res) => {
    try {
      // Check if file exists
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const file = req.file;
      const imageName = req.body.documentName || file.originalname;
      const userId = req.user.userId; // Get user ID from authenticated request

      // Validate file type
      if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
        return res.status(400).json({ message: "Invalid file type. Only images and PDFs are allowed." });
      }

      console.log("Upload started: Emitting upload-start event");
      // Notify frontend that upload has started
      io.emit("upload-progress", { progress: 0 });

      // Step 1: Upload file to S3 (asynchronous)
      const s3UploadPromise = uploadFileToS3(file);

      // Simulate progress update for upload
      let progress = 0;
      const interval = setInterval(() => {
        if (progress < 40) {
          progress += 5;
          console.log(`Upload progress: ${progress}%`);
          io.emit("upload-progress", { progress });
        } else {
          clearInterval(interval);
          console.log("Upload progress reached 50%");
        }
      }, 500); // Emit every 500ms

      // Wait for S3 upload to complete
      const fileKey = await s3UploadPromise;

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
      }, 1250); // Simulate each progress update every 700ms

      // Step 2: Extract text using GPT-4o (synchronously after Step 2)
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
      }, 500); // Emit every 700ms

      // Count occurrences of identical stickers
      const stickerMap = new Map();
      for (const sticker of extractedStickers) {
        const key = JSON.stringify(sticker);
        stickerMap.set(key, (stickerMap.get(key) || 0) + 1);
      }

      // Step 4: Insert each sticker into the database
      for (const [stickerStr, quantity] of stickerMap.entries()) {
        const { brand, product, dimensions, gtin, ref, lot } = JSON.parse(stickerStr);

        await db.query(
          `INSERT INTO product_labels (
            image_name, brand, item, dimensions, gtin, ref, lot, quantity, user_id,
            procedure_date, hospital, doctor, procedure_name, billing_no
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            imageName, brand, product, dimensions, gtin, ref, lot, quantity, userId,
            new Date(req.body.procedureDate), req.body.hospital, req.body.doctor, 
            req.body.procedure, req.body.billingNo
          ]
        );
      }

      // STEP 5: Once database insertion is done, finalize progress to 100%
    //   io.emit("upload-progress", { progress:  95});

      // Notify frontend that upload is complete (100% progress)
      setTimeout(() => {
        io.emit("upload-progress", { progress: 100 });
        io.emit("upload-complete", { message: "File upload and processing complete" });
      }, 700); // 700ms delay before completing

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

