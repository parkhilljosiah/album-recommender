import 'dotenv/config';
import express from 'express';
import { getAuthorizationUrl, exchangeCodeForTokens } from './spotifyAuth.js';
import { getPlaylistAlbums } from './spotifyClient.js';
import { getRecommendations } from './recommendations.js';

const app = express();
app.use(express.json());
app.use(express.static(new URL('../public', import.meta.url).pathname));
const PORT = process.env.PORT ?? 3000;
const REDIRECT_URI = process.env.REDIRECT_URI ?? `http://127.0.0.1:${PORT}/auth/callback`;

app.get('/auth/login', (_req, res) => {
  res.redirect(getAuthorizationUrl(REDIRECT_URI));
});

app.get('/auth/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).json({ error: `Spotify authorization denied: ${error}` });
  }
  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  try {
    await exchangeCodeForTokens(code, REDIRECT_URI);
    res.json({ message: 'Authorization successful. You can now call /playlists/:playlistId/albums.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Temporary debug endpoint — remove before production
app.get('/playlists/:playlistId/debug', async (req, res) => {
  const { getAccessToken } = await import('./spotifyAuth.js');
  const token = await getAccessToken();
  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(req.params.playlistId)}/items?limit=5`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await response.json();
  res.json(data);
});

app.get('/playlists/:playlistId/albums', async (req, res) => {
  const { playlistId } = req.params;

  try {
    const albums = await getPlaylistAlbums(playlistId);
    res.json({ playlist_id: playlistId, total: albums.length, albums });
  } catch (err) {
    const status = err.status ?? 500;
    res.status(status).json({ error: err.message });
  }
});

app.post('/playlists/:playlistId/recommendations', async (req, res) => {
  const { playlistId } = req.params;
  const { albums: likedAlbums } = req.body;

  try {
    const albums = likedAlbums?.length ? likedAlbums : await getPlaylistAlbums(playlistId);
    if (albums.length === 0) {
      return res.status(404).json({ error: 'No albums found in playlist' });
    }
    const recommendations = await getRecommendations(albums);
    res.json({ playlist_id: playlistId, based_on: albums.length, recommendations });
  } catch (err) {
    const status = err.status ?? 500;
    res.status(status).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
