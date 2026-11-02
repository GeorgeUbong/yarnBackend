import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { updateUsernameSchema } from '../utils/profile.validation';

const getAuthenticatedUserId = (req: Request) => {
  const userId = Number(req.authorId);
  return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
};

const detectImageMimeType = (buffer: Buffer): string | null => {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 6 &&
    (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
      buffer.subarray(0, 6).toString('ascii') === 'GIF89a')
  ) {
    return 'image/gif';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
};

export const updateUsername = async (req: Request, res: Response) => {
  const result = updateUsernameSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten().fieldErrors });
  }

  const userId = getAuthenticatedUserId(req);
  if (userId === null) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { username: result.data.username },
      select: { id: true, username: true, email: true, profileImage: true },
    });

    return res.status(200).json({ message: 'Name updated successfully', user });
  } catch {
    return res.status(500).json({ message: 'Failed to update name' });
  }
};

export const updateProfileImage = async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  if (userId === null) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const file = req.file;
  if (!file) {
    return res.status(400).json({ message: 'Profile image file is required in the image field' });
  }

  const imageMimeType = detectImageMimeType(file.buffer);
  if (!imageMimeType || imageMimeType !== file.mimetype) {
    return res.status(400).json({ message: 'Uploaded file must be a valid JPEG, PNG, GIF, or WebP image' });
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { profileImage: `data:${imageMimeType};base64,${file.buffer.toString('base64')}` },
      select: { id: true, username: true, email: true, profileImage: true },
    });

    return res.status(200).json({ message: 'Profile image updated successfully', user });
  } catch {
    return res.status(500).json({ message: 'Failed to update profile image' });
  }
};
