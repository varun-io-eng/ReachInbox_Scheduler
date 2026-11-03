import axios from 'axios';
import config from '../config/index.js';
import userModel from '../models/userModel.js';

const SLACK_AUTHORIZE_URL = 'https://slack.com/oauth/v2/authorize';
const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';

/**
 * Builds the Slack OAuth authorization URL.
 */
export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.SLACK_CLIENT_ID,
    scope: 'incoming-webhook,chat:write,channels:read',
    redirect_uri: config.SLACK_REDIRECT_URI,
    state,
  });
  return `${SLACK_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchanges an OAuth authorization code for an access token and webhook URL.
 */
export async function exchangeCode(code: string): Promise<{
  accessToken: string;
  webhookUrl: string;
  channelId: string;
}> {
  const response = await axios.post(
    SLACK_TOKEN_URL,
    new URLSearchParams({
      client_id: config.SLACK_CLIENT_ID,
      client_secret: config.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: config.SLACK_REDIRECT_URI,
    }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  const data = response.data;

  if (!data.ok) {
    throw new Error(`Slack OAuth error: ${data.error}`);
  }

  return {
    accessToken: data.access_token ?? '',
    webhookUrl: data.incoming_webhook?.url ?? '',
    channelId: data.incoming_webhook?.channel_id ?? '',
  };
}

/**
 * Sends a notification message to a Slack channel via webhook.
 */
export async function sendNotification(webhookUrl: string, message: string): Promise<void> {
  try {
    await axios.post(webhookUrl, {
      text: message,
      unfurl_links: false,
    });
    console.log('[Slack] Notification sent successfully');
  } catch (error) {
    console.error('[Slack] Failed to send notification:', error);
  }
}

/**
 * Notifies the user via Slack when a rate limit is hit.
 * Only sends if the user has Slack connected.
 */
export async function notifyRateLimitHit(
  userId: string,
  senderEmail: string,
  currentCount: number,
  limit: number
): Promise<void> {
  try {
    const user = await userModel.findById(userId);

    if (!user?.slack_webhook_url) {
      return; // Slack not connected — skip silently
    }

    const message =
      `⚠️ *Rate Limit Hit*\n` +
      `Sender: \`${senderEmail}\`\n` +
      `Current usage: ${currentCount}/${limit} emails this hour\n` +
      `Affected emails have been rescheduled for the next available window.`;

    await sendNotification(user.slack_webhook_url, message);
  } catch (error) {
    console.error('[Slack] Failed to send rate-limit notification:', error);
  }
}

export default {
  getAuthUrl,
  exchangeCode,
  sendNotification,
  notifyRateLimitHit,
};
