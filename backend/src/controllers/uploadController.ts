import { Request, Response } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import type { ApiResponse } from '../types/index.js';

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'text/plain',
      'application/vnd.ms-excel',
      'application/csv',
    ];
    if (
      allowedTypes.includes(file.mimetype) ||
      file.originalname.endsWith('.csv') ||
      file.originalname.endsWith('.txt')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and TXT files are allowed'));
    }
  },
});

/** Multer middleware — single file named "file" */
export const uploadMiddleware = upload.single('file');

/**
 * Extracts email addresses from raw text using regex.
 */
function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];

  // Deduplicate and lowercase
  const unique = [...new Set(matches.map((e) => e.toLowerCase()))];
  return unique;
}

/**
 * POST /api/upload/csv
 * Accepts a CSV or TXT file upload and extracts email addresses.
 */
export async function uploadCSV(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No file uploaded. Please attach a CSV or TXT file.',
      } satisfies ApiResponse);
      return;
    }

    const content = req.file.buffer.toString('utf-8');
    let emails: string[] = [];

    // Try CSV parsing first
    try {
      const records = parse(content, {
        columns: false,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
      }) as string[][];

      // Flatten all cells and extract emails
      const allCells = records.flat().join(' ');
      emails = extractEmails(allCells);
    } catch {
      // If CSV parsing fails, treat as plain text
      emails = extractEmails(content);
    }

    // If no emails found via CSV, try plain text extraction as fallback
    if (emails.length === 0) {
      emails = extractEmails(content);
    }

    console.log(
      `[Upload] Parsed ${emails.length} email(s) from ${req.file.originalname}`
    );

    res.json({
      success: true,
      data: {
        emails,
        count: emails.length,
        filename: req.file.originalname,
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[Upload] CSV parse error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to parse uploaded file',
    } satisfies ApiResponse);
  }
}

export default { uploadMiddleware, uploadCSV };

