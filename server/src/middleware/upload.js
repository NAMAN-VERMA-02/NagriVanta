import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { badRequest } from '../utils/http.js';

export const UPLOAD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

// shortcut: images live on local disk under unguessable names and are served publicly;
// move to S3/Cloudinary with signed URLs before a real deployment.
export const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, randomBytes(16).toString('hex') + EXT[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
  fileFilter: (req, file, cb) => (EXT[file.mimetype] ? cb(null, true) : cb(badRequest('Only JPG, PNG or WEBP images are allowed'))),
});

// Check magic bytes, since the client-sent mimetype can lie.
export function verifyImages(req, res, next) {
  for (const f of req.files || []) {
    const b = fs.readFileSync(f.path).subarray(0, 12);
    const isJpg = b[0] === 0xff && b[1] === 0xd8;
    const isPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    const isWebp = b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
    if (!(isJpg || isPng || isWebp)) {
      (req.files || []).forEach((x) => fs.rmSync(x.path, { force: true }));
      throw badRequest('Uploaded file is not a valid image');
    }
  }
  next();
}

export const fileUrls = (req) => (req.files || []).map((f) => `/uploads/${f.filename}`);
