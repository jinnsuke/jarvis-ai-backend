// Handles file uploads to AWS S3 and returns the uploaded file's URL

require("dotenv").config();
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const s3 = new S3Client({ region: process.env.AWS_REGION });

async function uploadFileToS3(file, userId, documentName) {
    const fileKey = `${userId}/${documentName}`; // Use userId as folder and documentName as filename
    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
    };
    
    console.log(`Uploading file to S3 with key: "${fileKey}"`);
    
    await s3.send(new PutObjectCommand(params));

    return fileKey;
}

module.exports = { uploadFileToS3 };