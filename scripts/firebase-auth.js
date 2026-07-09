const API_KEY = 'AIzaSyAPiiVfmJdGHje0gittK-7yFTYNTQNY6Fk';
const PROJECT_ID = 'basjfk-58536';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

let cachedToken = '';
let tokenExpiry = 0;

async function getAnonymousIdToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (!res.ok || !data.idToken) {
    throw new Error(`تعذر المصادقة مع Firebase (${data.error?.message || res.status})`);
  }

  cachedToken = data.idToken;
  tokenExpiry = Date.now() + 3500 * 1000;
  return cachedToken;
}

module.exports = {
  API_KEY,
  PROJECT_ID,
  FIRESTORE_BASE,
  getAnonymousIdToken,
};
