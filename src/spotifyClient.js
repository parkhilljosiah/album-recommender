import { getAccessToken } from './spotifyAuth.js';

const API_BASE = 'https://api.spotify.com/v1';
const MAX_RETRIES = 3;

async function spotifyFetch(path, retries = 0) {
  const token = await getAccessToken();

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 429) {
    if (retries >= MAX_RETRIES) throw new Error('Rate limit exceeded after retries');
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '1', 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return spotifyFetch(path, retries + 1);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = err.error?.message ?? res.statusText;
    const error = new Error(`Spotify API error ${res.status}: ${message}`);
    error.status = res.status;
    throw error;
  }

  return res.json();
}

export async function getPlaylistAlbums(playlistId) {
  const limit = 50;
  let offset = 0;

  const seenIds = new Set();
  const albums = [];

  while (true) {
    const page = await spotifyFetch(
      `/playlists/${encodeURIComponent(playlistId)}/items?limit=${limit}&offset=${offset}`
    );

    for (const item of page.items ?? []) {
      const album = item?.item?.album ?? item?.track?.album;
      if (!album?.id || seenIds.has(album.id)) continue;
      seenIds.add(album.id);
      albums.push({
        id: album.id,
        name: album.name,
        artists: album.artists.map((a) => a.name),
        image: album.images?.[0]?.url ?? null,
        spotify_url: album.external_urls?.spotify ?? null,
      });
    }

    if (!page.next) break;
    offset += limit;
  }

  return albums;
}
