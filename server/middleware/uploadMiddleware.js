import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Absolute path to the uploads folder (server/uploads)
export const uploadsDir = path.join(__dirname, '..', 'uploads');
// Make sure it exists: a fresh checkout / redeploy may not have the folder yet.
fs.mkdirSync(uploadsDir, { recursive: true });

/**
 * Uploads.
 *
 * Local disk is perfect for development, but free hosts (Render, Koyeb,
 * Fly.io) have an *ephemeral* filesystem: anything written to disk disappears
 * on the next deploy or restart. When Cloudinary credentials are present the
 * uploader stores media there instead, and returns the permanent HTTPS URL.
 *
 * Enable it by setting CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY /
 * CLOUDINARY_API_SECRET (all three) in the server environment. No extra npm
 * dependency is needed — the upload uses Cloudinary's signed REST API.
 */
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;
const FOLDER = process.env.CLOUDINARY_FOLDER || 'wchat';

export const isCloudStorage = Boolean(CLOUD_NAME && API_KEY && API_SECRET);

/** Sign and upload one buffered file to Cloudinary (signed `auto` upload). */
const uploadToCloudinary = async (file) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHash('sha1')
    .update(`folder=${FOLDER}&timestamp=${timestamp}${API_SECRET}`)
    .digest('hex');

  const form = new FormData();
  form.append(
    'file',
    new Blob([file.buffer], { type: file.mimetype || 'application/octet-stream' }),
    file.originalname || 'upload'
  );
  form.append('api_key', API_KEY);
  form.append('timestamp', String(timestamp));
  form.append('folder', FOLDER);
  form.append('signature', signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
    { method: 'POST', body: form }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Cloudinary upload failed');
  }
  return {
    url: data.secure_url,
    publicId: data.public_id,
    size: data.bytes,
  };
};

/** A multer storage engine that buffers the stream and uploads to Cloudinary. */
class CloudinaryStorage {
  _handleFile(req, file, cb) {
    const chunks = [];
    file.stream.on('data', (chunk) => chunks.push(chunk));
    file.stream.on('error', cb);
    file.stream.on('end', async () => {
      try {
        const result = await uploadToCloudinary({
          buffer: Buffer.concat(chunks),
          mimetype: file.mimetype,
          originalname: file.originalname,
        });
        cb(null, {
          path: result.url,
          filename: result.publicId,
          size: result.size,
        });
      } catch (error) {
        cb(error);
      }
    });
  }

  _removeFile(req, file, cb) {
    cb(null);
  }
}

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const storage = isCloudStorage ? new CloudinaryStorage() : diskStorage;

/**
 * The public URL for an uploaded file.
 *
 * Cloudinary files already carry an absolute URL in `path`; disk files are
 * served by Express from `/uploads`.
 */
export const fileUrl = (file) => {
  if (!file) return '';
  if (file.path && /^https?:\/\//i.test(file.path)) return file.path;
  if (file.filename) return `/uploads/${file.filename}`;
  return '';
};

const ALLOWED_PREFIXES = ['image/', 'audio/', 'video/'];
const BLOCKED_MIMES = new Set(['text/html', 'application/xhtml+xml', 'image/svg+xml']);
const BLOCKED_EXTENSIONS = new Set(['.html', '.htm', '.svg', '.xhtml']);

// Documents & archives (PDF, Office, text, zip…). Any file whose extension is in
// this list is also accepted, because some browsers send `application/octet-stream`.
const ALLOWED_EXACT = new Set([
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/rtf',
  'text/plain',
  'text/csv',
  'application/json',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.csv',
  '.rtf',
  '.json',
  '.zip',
  '.rar',
  '.7z',
]);

const fileFilter = (req, file, cb) => {
  const mimetype = file.mimetype || '';
  const ext = path.extname(file.originalname || '').toLowerCase();

  const blocked =
    BLOCKED_MIMES.has(mimetype) || BLOCKED_EXTENSIONS.has(ext);

  if (blocked) {
    const error = new Error(
      'That file type is not supported. Send images, audio, video, or documents.'
    );
    error.status = 400;
    cb(error);
    return;
  }

  const allowed =
    ALLOWED_PREFIXES.some((prefix) => mimetype.startsWith(prefix)) ||
    ALLOWED_EXACT.has(mimetype) ||
    ALLOWED_EXTENSIONS.has(ext);

  if (allowed) {
    cb(null, true);
    return;
  }

  const error = new Error(
    'That file type is not supported. Send images, audio, video, or documents.'
  );
  error.status = 400;
  cb(error);
};

const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
});

export default uploadMiddleware;
