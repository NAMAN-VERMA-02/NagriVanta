import { createHash, randomBytes } from 'node:crypto';
import exifr from 'exifr';
import multer from 'multer';
import sharp from 'sharp';
import Upload from '../models/Upload.js';
import { VIDEO_TYPES } from '../config/constants.js';
import { badRequest, notFound } from '../utils/http.js';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Files are kept in memory, verified, re-encoded, then stored in MongoDB, so the API also runs on
// serverless hosts (Vercel) whose disk is read-only and not shared between instances.
// shortcut: MongoDB media storage suits a pilot; move to S3/Cloudinary/Vercel Blob at scale.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 4 }, // Vercel caps request bodies at ~4.5 MB; clients compress first
  fileFilter: (req, file, cb) => (
    [...IMAGE_TYPES, ...VIDEO_TYPES].includes(file.mimetype) ? cb(null, true) : cb(badRequest('Only JPG, PNG, WEBP images or MP4/WEBM/MOV videos are allowed'))
  ),
});

// Magic-byte sniffing: the client-sent mimetype can lie.
export function sniff(b) {
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (b.toString('ascii', 4, 8) === 'ftyp') return b.toString('ascii', 8, 10) === 'qt' ? 'video/quicktime' : 'video/mp4';
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm';
  return null;
}

// multer gives an array (.array) or an object of arrays (.fields); flatten both.
const filesOf = (req) => (Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat());

export function verifyMedia(req, res, next) {
  for (const f of filesOf(req)) {
    f.detectedType = sniff(f.buffer);
    if (!f.detectedType) throw badRequest('Uploaded file is not a valid image or video');
    if (f.fieldname !== 'videos' && !IMAGE_TYPES.includes(f.detectedType)) throw badRequest('Photos must be JPG, PNG or WEBP');
    if (f.fieldname === 'videos' && !VIDEO_TYPES.includes(f.detectedType)) throw badRequest('Videos must be MP4, WEBM or MOV');
  }
  next();
}

// 64-bit difference hash: near-identical photos (re-saved, resized, recompressed) differ in few bits.
export async function dHash(buffer) {
  const px = await sharp(buffer).rotate().grayscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  let bits = '';
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) bits += px[y * 9 + x] > px[y * 9 + x + 1] ? '1' : '0';
  return BigInt(`0b${bits}`).toString(16).padStart(16, '0');
}

export function hammingHex(a, b) {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  while (x) { n += Number(x & 1n); x >>= 1n; }
  return n;
}

async function readExif(buffer) {
  try {
    const e = await exifr.parse(buffer, { gps: true, pick: ['DateTimeOriginal', 'CreateDate', 'latitude', 'longitude'] });
    if (!e) return {};
    const takenAt = e.DateTimeOriginal || e.CreateDate;
    return {
      takenAt: takenAt instanceof Date && !Number.isNaN(takenAt.getTime()) ? takenAt : undefined,
      lat: Number.isFinite(e.latitude) ? e.latitude : undefined,
      lng: Number.isFinite(e.longitude) ? e.longitude : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Stores verified files. Images are auto-rotated, resized to max 1600 px and re-encoded as JPEG,
 * which also strips any other embedded metadata before the file becomes public.
 * Returns public URLs plus what the server learned from the files.
 */
export async function saveMedia(req) {
  const out = { images: [], videos: [], hashes: [], sha256: [], exif: null };
  for (const f of filesOf(req)) {
    const isVideo = f.fieldname === 'videos';
    let data = f.buffer;
    let contentType = f.detectedType;
    let phash;
    let exif;
    if (!isVideo) {
      exif = await readExif(f.buffer);
      try {
        data = await sharp(f.buffer).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
        contentType = 'image/jpeg';
        phash = await dHash(data);
      } catch {
        throw badRequest('Could not read one of the images');
      }
    }
    const sha256 = createHash('sha256').update(data).digest('hex');
    const doc = await Upload.create({
      key: randomBytes(16).toString('hex'), data, contentType, kind: isVideo ? 'video' : 'image', size: data.length, sha256, phash, exif, uploadedBy: req.user?._id,
    });
    const url = `/uploads/${doc.key}`;
    if (isVideo) out.videos.push(url);
    else {
      out.images.push(url);
      out.hashes.push(phash);
      if (!out.exif && (exif.takenAt || exif.lat != null)) out.exif = exif;
    }
    out.sha256.push(sha256);
  }
  return out;
}

export const keyOf = (url) => url?.split('/').pop();

// Serves a stored file by its random key. Supports Range requests so videos can be scrubbed.
export async function serveUpload(req, res) {
  if (!/^[a-f\d]{32}$/.test(req.params.key)) throw notFound();
  const doc = await Upload.findOne({ key: req.params.key });
  if (!doc) throw notFound('File not found');
  const total = doc.data.length;
  res.set({ 'Content-Type': doc.contentType, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' });
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.get('range') || '');
  if (m) {
    const start = m[1] ? Number(m[1]) : total - Number(m[2]);
    const end = m[1] && m[2] ? Math.min(Number(m[2]), total - 1) : total - 1;
    if (start >= 0 && start <= end) {
      res.status(206).set('Content-Range', `bytes ${start}-${end}/${total}`);
      return res.send(doc.data.subarray(start, end + 1));
    }
  }
  return res.send(doc.data);
}
