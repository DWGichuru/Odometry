import { NextRequest } from "next/server";
import { handleApiRequest, readFormData, requireAuth, unwrap } from "@/lib/api-auth";
import { extractShiftFromScreenshot } from "@/lib/services/extraction";

/** Multipart body with a `file` earnings screenshot and an optional `startOdometer` field. */
export async function POST(req: NextRequest) {
  return handleApiRequest(async () => {
    const userId = await requireAuth(req);
    const form = await readFormData(req);
    const startOdometer = form.get("startOdometer");
    return unwrap(
      await extractShiftFromScreenshot(
        userId,
        form.get("file"),
        typeof startOdometer === "string" ? startOdometer : "",
      ),
    ).data;
  });
}
