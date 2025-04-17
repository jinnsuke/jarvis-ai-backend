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
          text: `
  This image contains multiple medical product stickers. Please extract structured data from each distinct sticker **accurately and conservatively**. For each sticker, return an object with the following fields:

  - "brand": The MedTech company name (e.g., Bard, Hemoteq AG). Only return valid company names—do not guess.
  - "product": The product name or model (e.g., Mustang™).
  - "dimensions": Any size, length, or measurement listed (e.g., "5.0mm x 100mm 80cm").
  - "gtin": The 14-digit Global Trade Item Number, if present.
  - "ref": The product reference number, often labeled REF or similar.
  - "lot": The lot or batch number, often labeled LOT or similar.

  ⚠️ Use **null** if any field is missing or unclear.
  ⚠️ Do NOT infer missing values or hallucinate.
  ⚠️ Be very careful when extracting the values, particularly GTIN.
  ⚠️ Note that there might be duplicate stickers in the image. Ensure that you account for them and DO NOT overlook them.
🔍⚠️ When extracting numbers, especially GTINs or references, pay attention to their **digit order**. Avoid transposing digits, and double-check sequences carefully.


  📦 Return only a JSON array like the following format:
  [
    {
      "brand": "Hemoteq AG",
      "product": "Ranger",
      "dimensions": "5.0mm x 100mm 80cm",
      "gtin": "08714729702812",
      "ref": "REF123456",
      "lot": "LOT78910"
    },
    ...
  ]
   
  After you have extracted the data, please verify the data you have extracted, especially the GTINs. Make any necessary corrections.
  `,
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
