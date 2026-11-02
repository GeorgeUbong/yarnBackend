import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';

const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PROFILE_IMAGE_SIZE,
    files: 1,
    fields: 0,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error('Only JPEG, PNG, GIF, and WebP images are supported'));
      return;
    }

    callback(null, true);
  },
});

export const uploadProfileImage = (req: Request, res: Response, next: NextFunction) => {
  upload.single('image')(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ message: 'Profile image must be 5 MB or smaller' });
      return;
    }

    res.status(400).json({
      message: error instanceof Error ? error.message : 'Invalid profile image upload',
    });
  });
};
