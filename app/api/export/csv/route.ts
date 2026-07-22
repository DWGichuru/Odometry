import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getExportContext } from "@/lib/export-data";
import { shiftsToCsv } from "@/lib/export";
import { alertOnFailure } from "@/lib/alert";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const ctx = await getExportContext(session.user.id, searchParams);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: 400 });
  }

  try {
    const csv = shiftsToCsv(ctx.shifts, ctx.distanceUnit, ctx.currency);

    const filename = `odometry-${ctx.period.filenameSuffix}.csv`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    await alertOnFailure("CSV export failed", err);
    return NextResponse.json({ error: "Could not generate CSV." }, { status: 500 });
  }
}
