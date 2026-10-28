import multer from 'multer';
import Upload from '../models/Upload.js';
import { badRequest, notFound } from '../utils/http.js';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Images are kept in memory, checked, then stored in MongoDB so the API also works on
// serverless hosts (Vercel) whose disk is read-only and not shared between instances.
// shortcut: MongoDB image storage is fine for a pilot; move to S3/Cloudinary/Vercel Blob at scale.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 3 }, // Vercel caps request bodies at ~4.5 MB
  fileFilter: (req, file, cb) => (TYPES.includes(file.mimetype) ? cb(null, true) : cb(badRequest('Only JPG, PNG or WEBP images are allowed'))),
});

// Check magic bytes, since the client-sent mimetype can lie.
function sniff(b) {
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export function verifyImages(req, res, next) {
  for (const f of req.files || []) {
    f.detectedType = sniff(f.buffer);
    if (!f.detectedType) throw badRequest('Uploaded file is not a valid image');
  }
  next();
}

// Persists verified files and returns their public URLs (/uploads/<id>).
export async function saveUploads(req) {
  const docs = await Promise.all((req.files || []).map((f) => Upload.create({
    data: f.buffer, contentType: f.detectedType, size: f.size, uploadedBy: req.user?._id,
  })));
  return docs.map((d) => `/uploads/${d._id}`);
}

export async function serveUpload(req, res) {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) throw notFound();
  const doc = await Upload.findById(req.params.id);
  if (!doc) throw notFound('Image not found');
  res.set({ 'Content-Type': doc.contentType, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
  res.send(doc.data);
}
