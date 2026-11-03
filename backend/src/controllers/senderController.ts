import { Request, Response } from 'express';
import senderModel from '../models/senderModel.js';
import etherealService from '../services/etherealService.js';
import type { ApiResponse } from '../types/index.js';

/**
 * POST /api/senders
 * Creates a new sender with auto-generated Ethereal credentials.
 */
export async function createSender(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { email, name } = req.body;

    if (!email || !name) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: email, name',
      } satisfies ApiResponse);
      return;
    }

    // Check if sender already exists for this user
    const existing = await senderModel.findByEmail(userId, email);
    if (existing) {
      res.status(409).json({
        success: false,
        error: 'Sender with this email already exists',
      } satisfies ApiResponse);
      return;
    }

    // Create with Ethereal credentials
    const sender = await etherealService.getOrCreateSender(userId, email, name);

    console.log(`[Sender] Created sender ${email} for user ${userId}`);

    res.status(201).json({
      success: true,
      data: {
        id: sender.id,
        email: sender.email,
        name: sender.name,
      },
      message: 'Sender created successfully',
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[Sender] Create error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create sender',
    } satisfies ApiResponse);
  }
}

/**
 * GET /api/senders
 * Lists all senders for the current user.
 */
export async function listSenders(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const senders = await senderModel.findByUserId(userId);

    res.json({
      success: true,
      data: senders.map((s) => ({
        id: s.id,
        email: s.email,
        name: s.name,
        created_at: s.created_at,
      })),
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[Sender] List error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list senders',
    } satisfies ApiResponse);
  }
}

/**
 * DELETE /api/senders/:id
 * Deletes a sender (scoped to the current user).
 */
export async function deleteSender(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const deleted = await senderModel.remove(id, userId);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Sender not found',
      } satisfies ApiResponse);
      return;
    }

    console.log(`[Sender] Deleted sender ${id} for user ${userId}`);

    res.json({
      success: true,
      message: 'Sender deleted successfully',
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[Sender] Delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete sender',
    } satisfies ApiResponse);
  }
}

export default { createSender, listSenders, deleteSender };

