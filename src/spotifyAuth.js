const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const AUTH_URL = 'https://accounts.spotify.com/authorize';

// In-memory token store (replace with a DB/session store for multi-user use)
let tokenStore = {
  accessToken: null,
  refreshToken: null,
  expiresAt: 0,
};

export function getAuthorizationUrl(redirectUri) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope: 'playlist-read-private',
    redirect_uri: redirectUri,
  });
  return `${AUTH_URL}?${params}`;
}

export async function exchangeCodeForTokens(code, redirectUri) {
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Token exchange failed ${res.status}: ${err.error_description ?? res.statusText}`);
  }

  const data = await res.json();
  storeTokens(data);
}

function storeTokens(data) {
  tokenStore.accessToken = data.access_token;
  tokenStore.refreshToken = data.refresh_token ?? tokenStore.refreshToken;
  tokenStore.expiresAt = Date.now() + (data.expires_in - 30) * 1000;
}

async function refreshAccessToken() {
  if (!tokenStore.refreshToken) {
    throw new Error('No refresh token available. Visit /auth/login to authorize.');
  }

  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenStore.refreshToken,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // Refresh token has expired — user must re-authorize
    tokenStore = { accessToken: null, refreshToken: null, expiresAt: 0 };
    throw new Error(`Token refresh failed ${res.status}: ${err.error_description ?? res.statusText}. Visit /auth/login to re-authorize.`);
  }

  const data = await res.json();
  storeTokens(data);
}

export async function getAccessToken() {
  if (!tokenStore.accessToken) {
    throw new Error('Not authorized. Visit /auth/login to authorize.');
  }

  if (Date.now() >= tokenStore.expiresAt) {
    await refreshAccessToken();
  }

  return tokenStore.accessToken;
}
