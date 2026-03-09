// api/gallery/images.js
import { Octokit } from '@octokit/rest';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    
    // Try to fetch index.json first (has captions + display names)
    try {
      const { data } = await octokit.repos.getContent({
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
        path: 'index.json',
        branch: process.env.GITHUB_BRANCH || 'main'
      });
      const content = Buffer.from(data.content, 'base64').toString('utf8');
      const index = JSON.parse(content);
      const images = Object.values(index).sort((a, b) => 
        new Date(b.uploadedAt) - new Date(a.uploadedAt)
      );
      return res.status(200).json(images);
    } catch (e) {
      // Fallback: list files directly
      const { data } = await octokit.repos.getContent({
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
        path: 'uploads',
        branch: process.env.GITHUB_BRANCH || 'main'
      });
      const images = Array.isArray(data) 
        ? data.filter(f => f.name.match(/\.(jpg|jpeg|png|webp|gif)$/i))
            .map(f => ({
              imageUrl: f.download_url,
              filename: f.name,
              uploadedAt: f.sha
            }))
        : [];
      return res.status(200).json(images);
    }
  } catch (err) {
    console.error('Gallery list error:', err);
    return res.status(500).json({ error: 'Failed to load gallery' });
  }
}
