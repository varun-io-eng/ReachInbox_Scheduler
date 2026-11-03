import { Request, Response } from 'express';
import slackService from '../services/slackService.js';
import userModel from '../models/userModel.js';
import config from '../config/index.js';
import type { ApiResponse } from '../types/index.js';

/**
 * GET /api/slack/connect
 * Redirects the user to Slack's OAuth authorization page.
 */
export function connect(req: Request, res: Response): void {
  // Use the user's session ID as the OAuth state for CSRF protection
  const state = req.sessionID;
  const authUrl = slackService.getAuthUrl(state);
  res.redirect(authUrl);
}

/**
 * GET /api/slack/callback
 * Handles the Slack OAuth callback, stores tokens, and redirects to the frontend.
 */
export async function callback(req: Request, res: Response): Promise<void> {
  try {
    const { code, error } = req.query;

    if (error) {
      console.error('[Slack] OAuth error:', error);
      res.redirect(`${config.FRONTEND_URL}/settings?slack=error&reason=${error}`);
      return;
    }

    if (!code || typeof code !== 'string') {
      res.redirect(`${config.FRONTEND_URL}/settings?slack=error&reason=missing_code`);
      return;
    }

    const { accessToken, webhookUrl, channelId } = await slackService.exchangeCode(code);

    // Store Slack tokens on the user
    await userModel.updateSlackTokens(req.user!.id, {
      slack_access_token: accessToken,
      slack_webhook_url: webhookUrl,
      slack_channel_id: channelId,
    });

    console.log(`[Slack] Connected for user ${req.user!.id}`);

    // Send a welcome notification
    if (webhookUrl) {
      await slackService.sendNotification(
        webhookUrl,
        '✅ *ReachInbox connected!*\nYou will receive rate-limit alerts and email delivery notifications here.'
      );
    }

    res.redirect(`${config.FRONTEND_URL}/settings?slack=connected`);
  } catch (error) {
    console.error('[Slack] Callback error:', error);
    res.redirect(`${config.FRONTEND_URL}/settings?slack=error&reason=exchange_failed`);
  }
}

/**
 * POST /api/slack/disconnect
 * Removes Slack tokens from the user's account.
 */
export async function disconnect(req: Request, res: Response): Promise<void> {
  try {
    await userModel.updateSlackTokens(req.user!.id, {
      slack_access_token: null,
      slack_webhook_url: null,
      slack_channel_id: null,
    });

    console.log(`[Slack] Disconnected for user ${req.user!.id}`);

    res.json({
      success: true,
      message: 'Slack disconnected successfully',
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[Slack] Disconnect error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect Slack',
    } satisfies ApiResponse);
  }
}

/**
 * GET /api/slack/status
 * Returns whether the current user has Slack connected.
 */
export function status(req: Request, res: Response): void {
  const connected = !!req.user!.slack_webhook_url;
  res.json({
    success: true,
    data: {
      connected,
      channel_id: req.user!.slack_channel_id ?? null,
    },
  } satisfies ApiResponse);
}

export default { connect, callback, disconnect, status };
