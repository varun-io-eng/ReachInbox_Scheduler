import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Request, Response, NextFunction } from 'express';
import config from '../config/index.js';
import userModel from '../models/userModel.js';

/**
 * Configure Passport with Google OAuth 2.0 strategy.
 * In DEV_AUTH_BYPASS mode, Google OAuth is skipped entirely.
 */
export function configurePassport(): void {
  if (config.DEV_AUTH_BYPASS) {
    console.log('[Auth] ⚠️  DEV_AUTH_BYPASS enabled — Google OAuth is disabled. Using mock user.');

    // Still need serialize/deserialize for session to work
    passport.serializeUser((user, done) => {
      done(null, (user as Express.User).id);
    });

    passport.deserializeUser(async (id: string, done) => {
      try {
        const user = await userModel.findById(id);
        done(null, user ?? null);
      } catch (error) {
        done(error, null);
      }
    });

    return;
  }

  // ── Google OAuth Strategy ──────────────────────────────────────────────
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.GOOGLE_CLIENT_ID,
        clientSecret: config.GOOGLE_CLIENT_SECRET,
        callbackURL: config.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value ?? '';
          const name = profile.displayName ?? '';
          const avatar = profile.photos?.[0]?.value ?? null;

          // Find or create user
          let user = await userModel.findByGoogleId(googleId);

          if (!user) {
            user = await userModel.create({
              id: crypto.randomUUID(),
              google_id: googleId,
              email,
              name,
              avatar,
            });
            console.log(`[Auth] New user created: ${email}`);
          } else {
            // Update profile info on each login
            user = await userModel.update(user.id, { email, name, avatar }) ?? user;
          }

          return done(null, user);
        } catch (error) {
          console.error('[Auth] Google strategy error:', error);
          return done(error as Error, undefined);
        }
      }
    )
  );

  // ── Session serialization ──────────────────────────────────────────────
  passport.serializeUser((user, done) => {
    done(null, (user as Express.User).id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await userModel.findById(id);
      done(null, user ?? null);
    } catch (error) {
      done(error, null);
    }
  });

  console.log('[Auth] Passport configured with Google OAuth 2.0');
}

/**
 * Express middleware that ensures the request is authenticated.
 * In DEV_AUTH_BYPASS mode, auto-creates and injects a dev user.
 */
export function isAuthenticated(req: Request, res: Response, next: NextFunction): void {
  if (config.DEV_AUTH_BYPASS) {
    // Auto-inject dev user if not already authenticated
    if (!req.user) {
      ensureDevUser(req).then(() => next()).catch((err) => {
        console.error('[Auth] Dev user creation failed:', err);
        res.status(500).json({ success: false, error: 'Dev auth failed' });
      });
      return;
    }
    return next();
  }

  if (req.isAuthenticated() && req.user) {
    return next();
  }
  res.status(401).json({
    success: false,
    error: 'Authentication required. Please log in.',
  });
}

/**
 * In dev bypass mode, ensures a dev user exists in the database
 * and attaches it to the request + session.
 */
async function ensureDevUser(req: Request): Promise<void> {
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
    console.log('[Auth] Created dev bypass user:', user.email);
  }

  // Attach user to request
  req.user = user;

  // Also log them into the session for subsequent requests
  await new Promise<void>((resolve, reject) => {
    req.login(user!, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export default { configurePassport, isAuthenticated };
