import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/jwt";
import { isFailure, type ServiceErrorCode, type ServiceFailure } from "@/lib/services/result";

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
  ) {
    super(message);
  }
}

const STATUS_BY_CODE: Record<ServiceErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNPROCESSABLE: 422,
  SUBSCRIPTION_REQUIRED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  UPSTREAM_ERROR: 502,
};

export function badRequest(message: string): ApiError {
  return new ApiError(message, 400, "VALIDATION_ERROR");
}

/** Returns the success value of a service call, or throws its failure as an ApiError. */
export function unwrap<T>(result: T | ServiceFailure): T {
  if (isFailure(result)) {
    throw new ApiError(result.error, STATUS_BY_CODE[result.code], result.code);
  }
  return result;
}

export async function requireAuth(req: NextRequest): Promise<string> {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const userId = token ? await verifyAccessToken(token) : null;
  if (!userId) {
    throw new ApiError("Missing or invalid access token", 401, "UNAUTHORIZED");
  }
  return userId;
}

export async function readJsonObject(req: NextRequest): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError("Request body must be valid JSON", 400, "INVALID_JSON");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError("Request body must be a JSON object", 400, "INVALID_JSON");
  }
  return body as Record<string, unknown>;
}

export async function readFormData(req: NextRequest): Promise<FormData> {
  try {
    return await req.formData();
  } catch {
    throw new ApiError("Request body must be multipart/form-data", 400, "INVALID_FORM_DATA");
  }
}

export function createSuccessResponse<T>(data: T, statusCode = 200) {
  return NextResponse.json({ success: true, data }, { status: statusCode });
}

export function createErrorResponse(message: string, code: string, statusCode = 400) {
  return NextResponse.json({ success: false, error: message, code }, { status: statusCode });
}

export async function handleApiRequest<T>(
  handler: () => Promise<T> | T,
  successStatus = 200,
): Promise<NextResponse> {
  try {
    return createSuccessResponse(await handler(), successStatus);
  } catch (error) {
    if (error instanceof ApiError) {
      return createErrorResponse(error.message, error.code, error.statusCode);
    }
    console.error("Unhandled API error:", error);
    return createErrorResponse("An unexpected error occurred", "INTERNAL_ERROR", 500);
  }
}
