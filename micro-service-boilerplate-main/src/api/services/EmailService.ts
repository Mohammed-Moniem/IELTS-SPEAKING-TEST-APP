import { env } from '@env';
import { Logger } from '@lib/logger';
import { Service } from 'typedi';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Transactional email service using the Resend HTTP API.
 * No SDK dependency required — uses native fetch.
 */
@Service()
export class EmailService {
  private log = new Logger(__filename);
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly frontendUrl: string;

  constructor() {
    this.apiKey = env.email?.resendApiKey || '';
    this.fromEmail = env.email?.fromEmail || 'noreply@spokio.com';
    this.frontendUrl = env.email?.frontendUrl || 'http://localhost:3000';
  }

  private get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /** Low-level email send via Resend HTTP API */
  public async send(params: SendEmailParams): Promise<boolean> {
    if (!this.isConfigured) {
      this.log.warn('EmailService :: Resend API key not configured — skipping email send');
      return false;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: params.to,
          subject: params.subject,
          html: params.html,
          text: params.text
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.log.error(`EmailService :: Resend API error ${response.status}: ${errorBody}`);
        return false;
      }

      this.log.info(`EmailService :: Email sent to ${params.to} — subject: ${params.subject}`);
      return true;
    } catch (error: any) {
      this.log.error(`EmailService :: Failed to send email: ${error?.message || error}`);
      return false;
    }
  }

  /** Send password reset email */
  public async sendPasswordReset(to: string, token: string, firstName: string): Promise<boolean> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

    return this.send({
      to,
      subject: 'Reset Your Spokio Password',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:48px auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden">
  <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:32px;text-align:center">
    <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700">Spokio</h1>
  </div>
  <div style="padding:32px">
    <h2 style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:700">Reset Your Password</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6">
      Hi ${firstName},<br><br>
      We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.
    </p>
    <a href="${resetUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 32px;border-radius:12px;font-size:14px;font-weight:600">
      Reset Password
    </a>
    <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;line-height:1.5">
      If you didn't request this, you can safely ignore this email. Your password will remain unchanged.
    </p>
  </div>
  <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #f3f4f6;text-align:center">
    <p style="margin:0;color:#9ca3af;font-size:12px">&copy; ${new Date().getFullYear()} Spokio. All rights reserved.</p>
  </div>
</div>
</body>
</html>`,
      text: `Hi ${firstName},\n\nReset your Spokio password by visiting: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.\n\n— Spokio`
    });
  }

  /** Send email verification email */
  public async sendEmailVerification(to: string, token: string, firstName: string): Promise<boolean> {
    const verifyUrl = `${this.frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;

    return this.send({
      to,
      subject: 'Verify Your Spokio Email',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:48px auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden">
  <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:32px;text-align:center">
    <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700">Spokio</h1>
  </div>
  <div style="padding:32px">
    <h2 style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:700">Verify Your Email</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6">
      Hi ${firstName},<br><br>
      Welcome to Spokio! Please verify your email address by clicking the button below. This link expires in 24 hours.
    </p>
    <a href="${verifyUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 32px;border-radius:12px;font-size:14px;font-weight:600">
      Verify Email
    </a>
    <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;line-height:1.5">
      If the button doesn't work, copy and paste this URL into your browser:<br>
      <a href="${verifyUrl}" style="color:#7c3aed;word-break:break-all">${verifyUrl}</a>
    </p>
  </div>
  <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #f3f4f6;text-align:center">
    <p style="margin:0;color:#9ca3af;font-size:12px">&copy; ${new Date().getFullYear()} Spokio. All rights reserved.</p>
  </div>
</div>
</body>
</html>`,
      text: `Hi ${firstName},\n\nWelcome to Spokio! Verify your email by visiting: ${verifyUrl}\n\nThis link expires in 24 hours.\n\n— Spokio`
    });
  }

  /** Send welcome email after registration */
  public async sendWelcome(to: string, firstName: string): Promise<boolean> {
    const dashboardUrl = `${this.frontendUrl}/app/dashboard`;

    return this.send({
      to,
      subject: 'Welcome to Spokio — Your IELTS Journey Starts Now',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:48px auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden">
  <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:32px;text-align:center">
    <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700">Welcome to Spokio!</h1>
  </div>
  <div style="padding:32px">
    <p style="margin:0 0 16px;color:#6b7280;font-size:15px;line-height:1.6">
      Hi ${firstName},<br><br>
      Your Spokio account is ready. Start practising all four IELTS modules with AI-powered feedback.
    </p>
    <ul style="margin:0 0 24px;padding:0 0 0 20px;color:#374151;font-size:14px;line-height:2">
      <li><strong>Speaking</strong> — AI examiner conversations with real-time feedback</li>
      <li><strong>Writing</strong> — Task 1 & 2 submissions graded by AI</li>
      <li><strong>Reading</strong> — Timed passage-based practice</li>
      <li><strong>Listening</strong> — Section-based audio tests</li>
      <li><strong>Full Mock Exams</strong> — Simulate a real IELTS test</li>
    </ul>
    <a href="${dashboardUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 32px;border-radius:12px;font-size:14px;font-weight:600">
      Go to Dashboard
    </a>
  </div>
  <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #f3f4f6;text-align:center">
    <p style="margin:0;color:#9ca3af;font-size:12px">&copy; ${new Date().getFullYear()} Spokio. All rights reserved.</p>
  </div>
</div>
</body>
</html>`,
      text: `Hi ${firstName},\n\nWelcome to Spokio! Your account is ready. Start practising all four IELTS modules at: ${dashboardUrl}\n\n— Spokio`
    });
  }
}
