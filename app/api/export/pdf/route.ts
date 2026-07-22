import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getExportContext } from "@/lib/export-data";
import { summarizeShifts } from "@/lib/export";
import { formatMoney } from "@/lib/currency";
import { formatDistance, KM_PER_MILE } from "@/lib/units";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { alertOnFailure } from "@/lib/alert";

export const dynamic = "force-dynamic";

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
    return await buildPdfResponse(ctx);
  } catch (err) {
    await alertOnFailure("PDF export failed", err);
    return NextResponse.json({ error: "Could not generate PDF." }, { status: 500 });
  }
}

async function buildPdfResponse(
  ctx: Exclude<Awaited<ReturnType<typeof getExportContext>>, { error: string }>,
) {
  const summary = summarizeShifts(ctx.shifts);
  const currencyCode = ctx.currency;
  const distanceUnit = ctx.distanceUnit;
  const period = ctx.period;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { height } = page.getSize();
  const MARGIN = 50;
  let y = height - MARGIN;

  const darkGray = rgb(0.15, 0.15, 0.15);
  const midGray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.7, 0.7, 0.7);
  const accent = rgb(0.18, 0.55, 0.34);

  page.drawText("Earnings Export", {
    x: MARGIN,
    y,
    size: 22,
    font: fontBold,
    color: darkGray,
  });

  y -= 28;
  page.drawText(period.label, {
    x: MARGIN,
    y,
    size: 14,
    font,
    color: midGray,
  });

  y -= 20;
  const generatedOn = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  page.drawText(`Generated on ${generatedOn}`, {
    x: MARGIN,
    y,
    size: 10,
    font,
    color: lightGray,
  });

  y -= 28;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: 595 - MARGIN, y },
    thickness: 1,
    color: lightGray,
  });

  y -= 36;

  const totalAmount = formatMoney(summary.totalEarnings, currencyCode);
  page.drawText(totalAmount, {
    x: MARGIN,
    y,
    size: 32,
    font: fontBold,
    color: accent,
  });

  y -= 28;
  page.drawText(`Total earnings  ·  ${summary.shiftCount} shift${summary.shiftCount === 1 ? "" : "s"} logged`, {
    x: MARGIN,
    y,
    size: 11,
    font,
    color: midGray,
  });

  y -= 40;

  const hoursStr = `${summary.totalHours.toFixed(1)} h`;
  const tripsStr = String(summary.totalTrips);
  const distanceStr = formatDistance(summary.totalDistanceKm, distanceUnit);

  const perHourStr = formatMoney(summary.earningsPerHour, currencyCode);
  const perTripStr = formatMoney(summary.earningsPerTrip, currencyCode);

  const distanceRate =
    distanceUnit === "MI"
      ? summary.earningsPerKm * KM_PER_MILE
      : summary.earningsPerKm;
  const perDistanceStr = formatMoney(distanceRate, currencyCode);
  const perDistanceLabel = distanceUnit === "MI" ? "Per mi" : "Per km";

  const metrics: { label: string; value: string }[] = [
    { label: "Hours", value: hoursStr },
    { label: "Trips", value: tripsStr },
    { label: "Distance", value: distanceStr },
    { label: "Per hour", value: perHourStr },
    { label: "Per trip", value: perTripStr },
    { label: perDistanceLabel, value: perDistanceStr },
  ];

  const COL_WIDTH = 225;
  const COL_GAP = 45;
  const ROW_HEIGHT = 44;
  let row = 0;
  let col = 0;

  for (const metric of metrics) {
    const x = MARGIN + col * (COL_WIDTH + COL_GAP);
    const ry = y - row * ROW_HEIGHT;

    page.drawText(metric.value, {
      x,
      y: ry,
      size: 18,
      font: fontBold,
      color: darkGray,
    });

    page.drawText(metric.label, {
      x,
      y: ry - 14,
      size: 9,
      font,
      color: lightGray,
    });

    col++;
    if (col >= 2) {
      col = 0;
      row++;
    }
  }

  const pdfBytes = await pdfDoc.save();

  const filename = `odometry-${period.filenameSuffix}.pdf`;
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
