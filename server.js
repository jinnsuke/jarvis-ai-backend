// Handles AWS Textract OCR processing

require("dotenv").config();
const { TextractClient, AnalyzeDocumentCommand } = require("@aws-sdk/client-textract");

const textract = new TextractClient({ region: process.env.AWS_REGION });

async function analyzeDocument(s3Bucket, s3Key) {
  const params = {
    Document: { S3Object: { Bucket: s3Bucket, Name: s3Key } },
    FeatureTypes: ["TABLES", "FORMS"],
  };

  const command = new AnalyzeDocumentCommand(params);
  const response = await textract.send(command);

  let extractedText = "";
  response.Blocks.forEach((block) => {
    if (block.BlockType === "LINE") {
      extractedText += block.Text + "\n";
    }
  });

  return extractedText;
}

module.exports = { analyzeDocument };