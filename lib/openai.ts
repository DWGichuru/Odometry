const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

const SCREENSHOT_EXTRACTION_PROMPT = `You are a shift data extractor. Extract the following fields from this rideshare earnings screenshot. Return ONLY a valid JSON object, no other text, no markdown, no explanation:

{
  "date": "YYYY-MM-DD",
  "platform": "UBER" | "LYFT" | "DOORDASH",
  "startTime": "HH:MM",
  "endTime": "HH:MM",
  "amountEarned": number,
  "tripsCompleted": integer,
  "endOdometer": number or null
}

If a field is not visible in the screenshot, set it to null.`;

const ODOMETER_EXTRACTION_PROMPT = `You are an odometer reader. Read the odometer value from this car dashboard photo. Return ONLY a valid JSON object, no other text, no markdown, no explanation:

{
  "reading": number,
  "unit": "km" | "mi"
}

The reading is the main total-distance number, NOT the trip meter. If the photo is too blurry or you cannot see an odometer, return { "reading": null, "unit": null }.`;

export async function callOpenAIVision(
  imageBase64: string,
  prompt: string = SCREENSHOT_EXTRACTION_PROMPT,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 300,
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  return content;
}

export async function callOpenAIOdometerVision(imageBase64: string): Promise<string> {
  return callOpenAIVision(imageBase64, ODOMETER_EXTRACTION_PROMPT);
}
