import Constants from 'expo-constants';

/**
 * Web Client ID من Firebase:
 * Authentication → Sign-in method → Google → Web client ID
 * (ينتهي بـ .apps.googleusercontent.com)
 */
export const GOOGLE_WEB_CLIENT_ID =
  (Constants.expoConfig?.extra?.googleWebClientId as string | undefined)?.trim() || '';

export const GOOGLE_IOS_CLIENT_ID =
  (Constants.expoConfig?.extra?.googleIosClientId as string | undefined)?.trim() ||
  GOOGLE_WEB_CLIENT_ID;

export const GOOGLE_ANDROID_CLIENT_ID =
  (Constants.expoConfig?.extra?.googleAndroidClientId as string | undefined)?.trim() ||
  GOOGLE_WEB_CLIENT_ID;

/** Expo Go: أضف هذا الرابط في Google Cloud → Authorized redirect URIs */
export const EXPO_AUTH_PROXY_REDIRECT_URI =
  Constants.expoConfig?.owner && Constants.expoConfig?.slug
    ? `https://auth.expo.io/@${Constants.expoConfig.owner}/${Constants.expoConfig.slug}`
    : '';

/** Native builds: reversed scheme من Web Client (معتمد من Google للتطبيقات) */
export function googleClientIdToRedirectUri(clientId: string): string {
  const stripped = clientId.replace(/\.apps\.googleusercontent\.com$/i, '');
  return `com.googleusercontent.apps.${stripped}:/oauth2redirect/google`;
}

export function getGoogleOAuthRedirectUri(clientId: string, expoGo: boolean): string {
  if (expoGo && EXPO_AUTH_PROXY_REDIRECT_URI) {
    return EXPO_AUTH_PROXY_REDIRECT_URI;
  }
  return googleClientIdToRedirectUri(clientId);
}

export function getGoogleReversedClientScheme(clientId: string): string {
  const stripped = clientId.replace(/\.apps\.googleusercontent\.com$/i, '');
  return `com.googleusercontent.apps.${stripped}`;
}

export const GOOGLE_NATIVE_URL_SCHEME = GOOGLE_WEB_CLIENT_ID
  ? getGoogleReversedClientScheme(GOOGLE_WEB_CLIENT_ID)
  : '';

export function hasGoogleAuthConfig(): boolean {
  return Boolean(GOOGLE_WEB_CLIENT_ID);
}

export function formatEmailDisplayName(email: string): string {
  const local = email.split('@')[0]?.trim();
  if (!local) return email;
  return local.replace(/[._-]+/g, ' ');
}

export interface GoogleProfile {
  email: string | null;
  name: string | null;
  picture: string | null;
}

function decodeJwtPayload(idToken: string): Record<string, unknown> | null {
  try {
    const base64Url = idToken.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join('')
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseGoogleProfileFromIdToken(idToken: string): GoogleProfile {
  const payload = decodeJwtPayload(idToken);
  if (!payload) {
    return { email: null, name: null, picture: null };
  }

  const email =
    typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : null;
  const name =
    typeof payload.name === 'string'
      ? payload.name.trim()
      : typeof payload.given_name === 'string'
        ? payload.given_name.trim()
        : null;
  const picture =
    typeof payload.picture === 'string' ? payload.picture.trim() : null;

  return { email, name, picture };
}

export function parseEmailFromIdToken(idToken: string): string | null {
  return parseGoogleProfileFromIdToken(idToken).email;
}

export function resolveUserDisplayName(
  displayName: string | null | undefined,
  email: string | null | undefined
): string | null {
  if (displayName?.trim()) return displayName.trim();
  if (email) return formatEmailDisplayName(email);
  return null;
}
