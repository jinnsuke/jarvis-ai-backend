require("dotenv").config();
const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function extractTextFromImage(base64Image) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `This image contains multiple product stickers. For each sticker, extract:
- brand
- product
- dimensions
- gtin
- ref
- lot

Return the result as a JSON array, one object per sticker. Use null for any missing values.`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${base64Image}`,
            },
          },
        ],
      },
    ],
  });

  const rawText = response.choices[0].message.content;

  // Safety: try to parse only valid JSON array
  const jsonMatch = rawText.match(/\[.*\]/s);
  if (!jsonMatch) throw new Error("Could not find a valid JSON array in GPT response");

  return JSON.parse(jsonMatch[0]);
}

module.exports = extractTextFromImage;
