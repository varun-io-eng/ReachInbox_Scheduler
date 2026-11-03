import { Request, Response } from 'express';
import passport from 'passport';
import config from '../config/index.js';
import userModel from '../models/userModel.js';
import type { ApiResponse } from '../types/index.js';

/**
 * GET /api/auth/google
 * Initiates Google OAuth 2.0 flow.
 * In DEV_AUTH_BYPASS mode, auto-logs in as dev user and redirects.
 */
export const googleAuth = config.DEV_AUTH_BYPASS
  ? async (req: Request, res: Response) => {
      // Auto-login as dev user
      const DEV_GOOGLE_ID = 'dev-user-001';
      let user = await userModel.findByGoogleId(DEV_GOOGLE_ID);

      if (!user) {
        user = await userModel.create({
          id: crypto.randomUUID(),
          google_id: DEV_GOOGLE_ID,
          email: 'dev@reachinbox.local',
          name: 'Dev User',
          avatar: null,
        });
        console.log('[Auth] Created dev bypass user');
      }

      req.login(user, (err) => {
        if (err) {
          console.error('[Auth] Dev login error:', err);
          return res.redirect(`${config.FRONTEND_URL}/?error=auth_failed`);
        }
        res.redirect(`${config.FRONTEND_URL}/dashboard`);
      });
    }
  : passport.authenticate('google', {
      scope: ['profile', 'email'],
    });

/**
 * GET /api/auth/google/callback
 * Handles the Google OAuth callback and redirects to the frontend.
 * In DEV_AUTH_BYPASS mode, redirects to dashboard directly.
 */
export const googleCallback = config.DEV_AUTH_BYPASS
  ? [
      (_req: Request, res: Response) => {
        res.redirect(`${config.FRONTEND_URL}/dashboard`);
      },
    ]
  : [
      passport.authenticate('google', {
        failureRedirect: `${config.FRONTEND_URL}/login?error=auth_failed`,
      }),
      (_req: Request, res: Response) => {
        res.redirect(`${config.FRONTEND_URL}/dashboard`);
      },
    ];

/**
 * GET /api/auth/me
 * Returns the currently authenticated user.
 */
export function me(req: Request, res: Response): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Not authenticated',
    } satisfies ApiResponse);
    return;
  }

  res.json({
    success: true,
    data: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      avatar: req.user.avatar,
      slackConnected: !!req.user.slack_webhook_url,
    },
  } satisfies ApiResponse);
}

/**
 * POST /api/auth/logout
 * Logs out the current user and destroys the session.
 */
export function logout(req: Request, res: Response): void {
  req.logout((err) => {
    if (err) {
      console.error('[Auth] Logout error:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to log out',
      } satisfies ApiResponse);
      return;
    }

    req.session.destroy((sessionErr) => {
      if (sessionErr) {
        console.error('[Auth] Session destroy error:', sessionErr);
      }
      res.json({
        success: true,
        message: 'Logged out successfully',
      } satisfies ApiResponse);
    });
  });
}

export default { googleAuth, googleCallback, me, logout };
