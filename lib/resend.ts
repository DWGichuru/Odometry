import { Resend } from "resend";

let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY!);
  }
  return _resend;
}

export async function sendVerificationEmail(email: string, token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_URL
  if (!baseUrl) {
    throw new Error(`Email server not setup correctly`)
  }

  const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;

  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: "notification@noreply.odometry.app",
    to: email,
    subject: "Verify your email address",
    html: `<p>Click the link below to verify your email address:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });

  if (error) {
    throw new Error(`Failed to send verification email: ${error.message}`)
  }

  return data
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_URL
  if (!baseUrl) {
    throw new Error(`Email server not setup correctly`)
  }

  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: "notification@noreply.odometry.app",
    to: email,
    subject: "Reset your password",
    html: `<p>Click the link below to set a new password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
  });

  if (error) {
    throw new Error(`Failed to send password reset email: ${error.message}`)
  }

  return data
}
