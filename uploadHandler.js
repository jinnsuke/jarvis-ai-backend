const express = require("express");
const multer = require("multer");
const fs = require("fs");
const uploadFileToS3 = require("./s3").uploadFileToS3;
const extractTextFromImage = require("./gptOCR");
const db = require("./db");

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const imageName = req.body.documentName || file.originalname;

    // 1. Upload to S3
    const fileKey = await uploadFileToS3(file);

    // 2. Convert to base64
    const base64Image = file.buffer.toString("base64");

    // 3. Extract text using GPT-4o
    const extractedStickers = await extractTextFromImage(base64Image);

    // Count occurrences of identical stickers
    const stickerMap = new Map();
    for (const sticker of extractedStickers) {
        const key = JSON.stringify(sticker);
        if (stickerMap.has(key)) {
            stickerMap.set(key, stickerMap.get(key) + 1);
        } else {
            stickerMap.set(key, 1);
        }
    }

    // 4. Insert each sticker into the database
    for (const [stickerStr, quantity] of stickerMap.entries()) {
        const { brand, product, dimensions, gtin, ref, lot } = JSON.parse(stickerStr);

        await db.query(
            `INSERT INTO product_labels (
            image_name, brand, item, dimensions, gtin, ref, lot, quantity
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [imageName, brand, product, dimensions, gtin, ref, lot, quantity]
        );
    }

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
  }
});

module.exports = router;
