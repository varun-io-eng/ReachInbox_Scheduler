import nodemailer from 'nodemailer';
import senderModel from '../models/senderModel.js';
import type { Sender } from '../types/index.js';

/**
 * Creates a new Ethereal test email account.
 */
export async function createEtherealAccount(): Promise<{ user: string; pass: string }> {
  const testAccount = await nodemailer.createTestAccount();
  console.log('[Ethereal] Created test account:', testAccount.user);
  return {
    user: testAccount.user,
    pass: testAccount.pass,
  };
}

/**
 * Sends an email via Ethereal SMTP.
 *
 * @returns The nodemailer message ID and the Ethereal preview URL.
 */
export async function sendEmail(
  from: string,
  to: string,
  subject: string,
  body: string,
  etherealUser: string,
  etherealPass: string
): Promise<{ messageId: string; previewUrl: string | false }> {
  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: etherealUser,
      pass: etherealPass,
    },
  });

  const info = await transporter.sendMail({
    from: `"${from}" <${etherealUser}>`,
    to,
    subject,
    text: body,
    html: `<div style="font-family: sans-serif; line-height: 1.6;">${body.replace(/\n/g, '<br>')}</div>`,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  console.log(`[Ethereal] Sent email to ${to} | Preview: ${previewUrl}`);

  return {
    messageId: info.messageId,
    previewUrl,
  };
}

/**
 * Gets an existing sender or creates a new one with fresh Ethereal credentials.
 */
export async function getOrCreateSender(
  userId: string,
  senderEmail: string,
  senderName: string
): Promise<Sender> {
  // Check for existing sender
  const existing = await senderModel.findByEmail(userId, senderEmail);
  if (existing) {
    return existing;
  }

  // Create new Ethereal account and sender record
  const { user, pass } = await createEtherealAccount();
  const sender = await senderModel.create({
    id: crypto.randomUUID(),
    user_id: userId,
    email: senderEmail,
    name: senderName,
    ethereal_user: user,
    ethereal_pass: pass,
  });

  console.log(`[Ethereal] Registered sender: ${senderEmail} (Ethereal: ${user})`);
  return sender;
}

export default {
  createEtherealAccount,
  sendEmail,
  getOrCreateSender,
};
