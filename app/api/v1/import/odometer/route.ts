import { NextRequest } from "next/server";
import { handleApiRequest, readFormData, requireAuth, unwrap } from "@/lib/api-auth";
import { extractOdometerFromPhoto, readImageFile } from "@/lib/services/extraction";

/**
 * Multipart body with a `file` image of the odometer. The returned `reading` is in km,
 * ready to pass to /sessions/start or /sessions/end.
 */
export async function POST(req: NextRequest) {
  return handleApiRequest(async () => {
    const userId = await requireAuth(req);
    const form = await readFormData(req);
    const { base64 } = unwrap(await readImageFile(form.get("file")));
    return unwrap(await extractOdometerFromPhoto(userId, base64)).data;
  });
}
