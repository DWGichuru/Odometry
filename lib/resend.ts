import { Resend } from "resend";

let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY!);
  }
  return _resend;
}

export async function sendVerificationEmail(email: string, token: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000";
  const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;

  const resend = getResend();
  return resend.emails.send({
    from: "noreply@odometry.app",
    to: email,
    subject: "Verify your email address",
    html: `<p>Click the link below to verify your email address:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });
}
