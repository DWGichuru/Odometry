const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-5.4-nano";

const EXTRACTION_PROMPT = `You are a shift data extractor. Extract the following fields from this rideshare earnings screenshot. Return ONLY a valid JSON object, no other text, no markdown, no explanation:

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

export async function callOpenAIVision(imageBase64: string): Promise<string> {
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
            { type: "text", text: EXTRACTION_PROMPT },
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
