"use server";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail as sendEmail } from "@/lib/resend";
import { alertOnFailure } from "@/lib/alert";


const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

export type SendVerificationResult = | "sent" | "skipped-cooldown" | "skipped-verification" | "failed"

export async function sendVerificationEmail(email: string): Promise<SendVerificationResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerified) {
    return "skipped-verification";
  }

  const existing = await prisma.verificationToken.findFirst({
    where: { identifier: email },
  });
  if (existing) {
    const issuedAt = existing.expires.getTime() - TOKEN_TTL_MS;
    if (Date.now() - issuedAt < RESEND_COOLDOWN_MS) {
      return "skipped-cooldown";
    }
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    },
  });

  try {
    await sendEmail(email, token);
  } catch (err) {
    alertOnFailure("Failed sending user email", err)
    return "failed"
  }

  return "sent"
}

export async function confirmEmailVerification(
  token: string,
): Promise<{ success: boolean; error?: string }> {
  const vt = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!vt) {
    return { success: false, error: "This verification link is invalid or was already used." };
  }

  if (vt.expires < new Date()) {
    return { success: false, error: "This verification link has expired. Please request a new one." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { email: vt.identifier },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({ where: { token } }),
  ]);

  return { success: true };
}
