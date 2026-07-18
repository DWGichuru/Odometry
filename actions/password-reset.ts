"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/resend";
import { alertOnFailure } from "@/lib/alert";

const TOKEN_TTL_MS = 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

export async function requestPasswordReset(email: string): Promise<{ success: boolean }> {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { credential: true },
  });

  if (!user?.credential) {
    return { success: true };
  }

  const existing = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id },
  });
  if (existing) {
    const issuedAt = existing.expires.getTime() - TOKEN_TTL_MS;
    if (Date.now() - issuedAt < RESEND_COOLDOWN_MS) {
      return { success: true };
    }
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expires },
  });

  try {
    await sendPasswordResetEmail(normalizedEmail, token);
  } catch (err) {
    await alertOnFailure("Failed to send password reset email", err);
  }

  return { success: true };
}

export async function confirmPasswordReset(
  token: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  if (newPassword.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });

  if (!resetToken) {
    return { success: false, error: "This reset link is invalid or was already used." };
  }

  if (resetToken.expires < new Date()) {
    return { success: false, error: "This reset link has expired. Please request a new one." };
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    prisma.credential.update({
      where: { userId: resetToken.userId },
      data: { hashedPassword },
    }),
    prisma.passwordResetToken.delete({ where: { token } }),
  ]);

  return { success: true };
}
