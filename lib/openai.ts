const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

function buildScreenshotExtractionPrompt(today: string): string {
  return `You are a shift data extractor. Extract the following fields from this rideshare earnings screenshot. Return ONLY a valid JSON object, no other text, no markdown, no explanation:

{
  "date": "YYYY-MM-DD",
  "platform": "UBER" | "LYFT" | "DOORDASH",
  "startTime": "HH:MM",
  "endTime": "HH:MM",
  "amountEarned": number,
  "tripsCompleted": integer,
  "endOdometer": number or null
}

Today's date is ${today}. Rideshare earnings screenshots often show a date with
no year (e.g. "Thu, Jun 26"). If the screenshot's date has no year, infer it
from today's date: use the current year, unless that would place the date in
the future, in which case use the previous year instead.

If a field is not visible in the screenshot, set it to null.`;
}

const ODOMETER_EXTRACTION_PROMPT = `You are an odometer reader. Read the odometer value from this car dashboard photo. Return ONLY a valid JSON object, no other text, no markdown, no explanation:

{
  "reading": number,
  "unit": "km" | "mi"
}

The reading is the main total-distance number, NOT the trip meter. If the photo is too blurry or you cannot see an odometer, return { "reading": null, "unit": null }.`;

export async function callOpenAIVision(
  imageBase64: string,
  prompt: string = buildScreenshotExtractionPrompt(
    new Date().toISOString().slice(0, 10),
  ),
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

interface InsightShiftInput {
  date: string;
  weekday: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  amountEarned: number;
  tripsCompleted: number;
  distanceKm: number;
  platform: string;
}

export function buildInsightsPrompt(
  shifts: InsightShiftInput[],
  driverName?: string,
): string {
  const rows = shifts
    .map(
      (s) =>
        `${s.date} | ${s.weekday} | ${s.startTime}-${s.endTime} | ${s.durationHours.toFixed(2)}h | $${s.amountEarned.toFixed(2)} | ${s.tripsCompleted} trips | ${s.distanceKm.toFixed(1)}km | ${s.platform}`,
    )
    .join("\n");

  const addressing = driverName
    ? `You're a coach talking directly to a gig driver named ${driverName}. Address them by name at least once.`
    : "You're a coach talking directly to a gig driver.";

  return `${addressing} Write to them in second person ("you"/"your"), in a warm, conversational tone, like a coach giving advice, not an analyst writing a report. Be honest and critical, not just encouraging: call out what's underperforming as directly as what's going well, so they get maximum value out of their own history instead of a pep talk. Here is every shift from their history, one per line, as "date | weekday | start-end | duration | earnings | trips | distance | platform":

${rows}

Return ONLY a valid JSON object, no other text, no markdown, no explanation:

{
  "bestTimes": string,
  "idealShiftLength": string,
  "notWorking": string
}

- "bestTimes": which days and times of day earn them the most per hour. If earnings per hour show a clear upward or downward trend across the history, mention that trend here too.
- "idealShiftLength": the shift duration that tends to earn them the best per hour.
- "notWorking": patterns that are costing them money - for example a weekday or time slot that consistently underperforms, or (when they use more than one platform) a platform that earns meaningfully less per hour or per trip than another. Be specific and direct about what to stop or change, not just what to keep doing.

Each field must be 1-3 sentences of plain, specific advice grounded only in the data above, written directly to them - honest and critical where the data calls for it, encouraging where it's earned. Do not invent numbers not supported by the data.`;
}

export async function callOpenAIChat(prompt: string): Promise<string> {
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
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.65,
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
