// api/gallery/upload.js
import { verifyUser } from '../utils/whitelist.js';
import { Octokit } from '@octokit/rest';
import busboy from 'busboy';
import { Readable } from 'stream';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const bb = busboy({ headers: req.headers });
    const fields = {};
    const files = {};

    bb.on('field', (name, val) => { fields[name] = val; });
    bb.on('file', (name, file, info) => {
      const chunks = [];
      file.on('data', chunk => chunks.push(chunk));
      file.on('end', () => {
        files[name] = { buffer: Buffer.concat(chunks), filename: info.filename, mimeType: info.mimeType };
      });
    });

    bb.on('close', async () => {
      try {
        const { username, uuid, displayName, caption } = fields;
        const image = files.image;

        if (!image) return res.status(400).json({ error: 'Image required' });
        if (!username) return res.status(400).json({ error: 'Whitelist username required' });

        // === SERVER-SIDE WHITELIST VERIFICATION (NON-BYPASSABLE) ===
        const verification = verifyUser(username, uuid);
        if (!verification.valid) {
          return res.status(403).json({ error: verification.error });
        }

        // === DISPLAY NAME VALIDATION ===
        const cleanDisplayName = (displayName || '').trim();
        const cleanWhitelistName = verification.whitelistName.trim();

        if (!cleanDisplayName) {
          return res.status(400).json({ error: 'Display name is required' });
        }
        // CRITICAL: Display name CANNOT match whitelisted username
        if (cleanDisplayName.toLowerCase() === cleanWhitelistName.toLowerCase()) {
          return res.status(400).json({ 
            error: `Display name cannot be "${cleanWhitelistName}". Choose a different name.` 
          });
        }

        // === IMAGE VALIDATION ===
        if (!image.mimeType.startsWith('image/')) {
          return res.status(400).json({ error: 'Images only (JPG, PNG, WebP, GIF)' });
        }
        if (image.buffer.length > 5 * 1024 * 1024) {
          return res.status(400).json({ error: 'File too large (max 5MB)' });
        }

        // === GENERATE SAFE FILENAME ===
        const ext = image.filename.split('.').pop().toLowerCase();
        if (!['jpg','jpeg','png','webp','gif'].includes(ext)) {
          return res.status(400).json({ error: 'Unsupported format' });
        }
        const safeFilename = `uploads/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;

        // === UPLOAD TO GITHUB ===
        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
        
        await octokit.repos.createOrUpdateFileContents({
          owner: process.env.GITHUB_OWNER,
          repo: process.env.GITHUB_REPO,
          path: safeFilename,
          message: `Gallery upload by ${cleanWhitelistName} (${cleanDisplayName})`,
          content: image.buffer.toString('base64'),
          branch: process.env.GITHUB_BRANCH || 'main'
        });

        // === SAVE METADATA TO index.json ===
        const metadata = {
          uuid: verification.uuid,
          whitelistName: cleanWhitelistName,
          displayName: cleanDisplayName,
          caption: (caption || '').slice(0, 150),
          filename: safeFilename,
          uploadedAt: new Date().toISOString(),
          imageUrl: `https://raw.githubusercontent.com/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/${process.env.GITHUB_BRANCH || 'main'}/${safeFilename}`
        };

        let index = {};
        try {
          const { data } = await octokit.repos.getContent({
            owner: process.env.GITHUB_OWNER,
            repo: process.env.GITHUB_REPO,
            path: 'index.json',
            branch: process.env.GITHUB_BRANCH || 'main'
          });
          index = JSON.parse(Buffer.from(data.content, 'base64').toString());
        } catch (e) { /* index.json doesn't exist yet */ }

        index[safeFilename] = metadata;

        await octokit.repos.createOrUpdateFileContents({
          owner: process.env.GITHUB_OWNER,
          repo: process.env.GITHUB_REPO,
          path: 'index.json',
          message: `Update index - ${cleanDisplayName}`,
          content: Buffer.from(JSON.stringify(index, null, 2)).toString('base64'),
          branch: process.env.GITHUB_BRANCH || 'main'
        });

        return res.status(200).json({
          success: true,
          imageUrl: metadata.imageUrl,
          displayName: metadata.displayName,
          caption: metadata.caption
        });

      } catch (err) {
        console.error('Upload error:', err);
        return res.status(500).json({ error: 'Upload failed' });
      }
    });

    Readable.from(req).pipe(bb);

  } catch (err) {
    console.error('Request error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
