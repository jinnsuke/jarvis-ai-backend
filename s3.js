// Handles file uploads to AWS S3 and returns the uploaded file's URL

require("dotenv").config();
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const s3 = new S3Client({ region: process.env.AWS_REGION });

async function uploadFileToS3(file) {
    const fileKey = file.originalname.replace(/\s+/g, "_"); // Replace spaces with underscores
    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
    };
    
    console.log(`Uploading file to S3 with key: "${fileKey}"`);
    
    await s3.send(new PutObjectCommand(params)); // Do not return the entire command response

    return fileKey; // Return only the file key
}

module.exports = { uploadFileToS3 };