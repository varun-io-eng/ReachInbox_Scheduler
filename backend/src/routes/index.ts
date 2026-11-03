import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.js';

// Controllers
import authController from '../controllers/authController.js';
import emailController from '../controllers/emailController.js';
import slackController from '../controllers/slackController.js';
import senderController from '../controllers/senderController.js';
import uploadController from '../controllers/uploadController.js';

const router = Router();

// ─── Auth routes (public) ─────────────────────────────────────────────────────
router.get('/auth/google', authController.googleAuth);
router.get('/auth/google/callback', ...authController.googleCallback);
router.get('/auth/me', authController.me);
router.post('/auth/logout', authController.logout);

// ─── Email routes (protected) ─────────────────────────────────────────────────
router.post('/emails/schedule', isAuthenticated, emailController.scheduleEmails);
router.get('/emails/scheduled', isAuthenticated, emailController.getScheduledEmails);
router.get('/emails/sent', isAuthenticated, emailController.getSentEmails);
router.get('/emails/search', isAuthenticated, emailController.searchEmailsHandler);
router.get('/emails/stats', isAuthenticated, emailController.getStats);
router.get('/emails/:id', isAuthenticated, emailController.getEmailById);

// ─── Slack routes (protected) ─────────────────────────────────────────────────
router.get('/slack/connect', isAuthenticated, slackController.connect);
router.get('/slack/callback', isAuthenticated, slackController.callback);
router.post('/slack/disconnect', isAuthenticated, slackController.disconnect);
router.get('/slack/status', isAuthenticated, slackController.status);

// ─── Sender routes (protected) ────────────────────────────────────────────────
router.post('/senders', isAuthenticated, senderController.createSender);
router.get('/senders', isAuthenticated, senderController.listSenders);
router.delete('/senders/:id', isAuthenticated, senderController.deleteSender);

// ─── Upload routes (protected) ────────────────────────────────────────────────
router.post(
  '/upload/csv',
  isAuthenticated,
  uploadController.uploadMiddleware,
  uploadController.uploadCSV
);

export default router;

