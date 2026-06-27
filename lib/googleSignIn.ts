import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import {
  AccessTokenRequest,
  AuthRequest,
  loadAsync,
  makeRedirectUri,
  ResponseType,
} from 'expo-auth-session';
import { generateHexStringAsync } from 'expo-auth-session/build/PKCE';
import { discovery } from 'expo-auth-session/providers/google';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import {
  EXPO_AUTH_PROXY_REDIRECT_URI,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from './authConfig';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
];

function logGoogle(step: string, detail?: unknown) {
  if (__DEV__) {
    console.log(`[Google Sign-In] ${step}`, detail ?? '');
  }
}

function getGoogleClientId(): string {
  return (
    Platform.select({
      ios: GOOGLE_IOS_CLIENT_ID,
      android: GOOGLE_ANDROID_CLIENT_ID,
      default: GOOGLE_WEB_CLIENT_ID,
    }) || GOOGLE_WEB_CLIENT_ID
  );
}

function getProjectFullName(): string {
  const owner = Constants.expoConfig?.owner;
  const slug = Constants.expoConfig?.slug;
  if (owner && slug) {
    return `@${owner}/${slug}`;
  }
  return Constants.expoConfig?.originalFullName ?? '';
}

function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

function getExpoGoReturnUrl(): string {
  let hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri && Constants.linkingUri) {
    hostUri = Constants.linkingUri.replace(/^[a-zA-Z0-9+.-]+:\/\//, '').replace(/\/--(\/.*)?$/, '');
  }

  const queryParams = hostUri
    ? Object.fromEntries(new URLSearchParams(hostUri.split('?')[1] ?? ''))
    : undefined;

  return Linking.createURL('expo-auth-session', {
    queryParams,
  });
}

function buildExpoProxyStartUrl(authUrl: string, appReturnUrl: string): string {
  const proxyBase = `${EXPO_AUTH_PROXY_REDIRECT_URI}/start`;
  const query = new URLSearchParams({
    authUrl,
    returnUrl: appReturnUrl,
  });
  return `${proxyBase}?${query.toString()}`;
}

function extractOAuthParams(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  return {
    code: params.code as string | undefined,
    idToken: params.id_token as string | undefined,
    accessToken: params.access_token as string | undefined,
    error: (params.error as string | undefined) || errorCode || undefined,
    errorDescription: params.error_description as string | undefined,
    state: params.state as string | undefined,
  };
}

async function exchangeCodeForIdToken(
  request: AuthRequest,
  code: string,
  redirectUri: string,
  clientId: string
): Promise<string | undefined> {
  const exchangeRequest = new AccessTokenRequest({
    clientId,
    redirectUri,
    code,
    extraParams: {
      code_verifier: request.codeVerifier || '',
    },
  });
  const tokenResult = await exchangeRequest.performAsync(discovery);
  logGoogle('code exchange ok', { hasIdToken: !!tokenResult.idToken });
  return tokenResult.idToken ?? undefined;
}

export type GoogleSignInResult =
  | { ok: true; idToken: string }
  | { ok: false; reason: string; detail?: string };

type PreparedGoogleSession = {
  startUrl: string;
  browserReturnUrl: string;
  request: AuthRequest;
  expoGo: boolean;
  oauthRedirectUri: string;
  clientId: string;
};

async function buildGoogleSession(): Promise<PreparedGoogleSession> {
  const expoGo = isExpoGo();
  const clientId = expoGo ? GOOGLE_WEB_CLIENT_ID : getGoogleClientId();
  if (!clientId) {
    throw new Error('missing_client');
  }

  const oauthRedirectUri =
    expoGo && EXPO_AUTH_PROXY_REDIRECT_URI
      ? EXPO_AUTH_PROXY_REDIRECT_URI
      : makeRedirectUri({
          scheme: (Constants.expoConfig?.scheme as string | undefined) ?? 'tofahastore',
          path: 'oauthredirect',
        });

  const extraParams: Record<string, string> = { prompt: 'select_account' };
  if (expoGo) {
    extraParams.nonce = await generateHexStringAsync(16);
  }

  const request = await loadAsync(
    {
      clientId,
      redirectUri: oauthRedirectUri,
      scopes: GOOGLE_SCOPES,
      extraParams,
      usePKCE: !expoGo,
      responseType: expoGo ? ResponseType.IdToken : ResponseType.Code,
    },
    discovery
  );

  const authUrl = await request.makeAuthUrlAsync(discovery);

  let startUrl = authUrl;
  let browserReturnUrl = oauthRedirectUri;

  if (expoGo && EXPO_AUTH_PROXY_REDIRECT_URI) {
    if (!getProjectFullName()) {
      throw new Error('project_name');
    }
    const appReturnUrl = getExpoGoReturnUrl();
    startUrl = buildExpoProxyStartUrl(authUrl, appReturnUrl);
    browserReturnUrl = appReturnUrl;
  }

  return { startUrl, browserReturnUrl, request, expoGo, oauthRedirectUri, clientId };
}

async function finishGoogleSignIn(session: PreparedGoogleSession): Promise<GoogleSignInResult> {
  const { startUrl, browserReturnUrl, request, expoGo, oauthRedirectUri, clientId } = session;

  logGoogle('start', {
    expoGo,
    oauthRedirectUri,
    browserReturnUrl,
    clientId: clientId.slice(0, 12) + '...',
    flow: expoGo ? 'id_token+proxy' : 'code+pkce',
  });

  logGoogle('opening browser', { startUrl: startUrl.slice(0, 80) + '...', browserReturnUrl });
  const browserResult = await WebBrowser.openAuthSessionAsync(startUrl, browserReturnUrl, {
    preferEphemeralSession: false,
    showInRecents: true,
  });

  logGoogle('browser result', {
    type: browserResult.type,
    url: 'url' in browserResult ? browserResult.url?.slice(0, 120) : undefined,
  });

  if (browserResult.type !== 'success' || !('url' in browserResult) || !browserResult.url) {
    return {
      ok: false,
      reason:
        browserResult.type === 'cancel' || browserResult.type === 'dismiss'
          ? 'cancelled'
          : 'browser_failed',
      detail: browserResult.type,
    };
  }

  const parsed = request.parseReturnUrl(browserResult.url);
  const manual = extractOAuthParams(browserResult.url);

  logGoogle('parsed return', {
    parsedType: parsed.type,
    manualError: manual.error,
    hasCode: !!(parsed.params?.code || manual.code),
    hasIdToken: !!(parsed.params?.id_token || manual.idToken),
  });

  if (manual.error) {
    return {
      ok: false,
      reason: 'oauth_error',
      detail: manual.errorDescription || manual.error,
    };
  }

  let idToken =
    parsed.params?.id_token ||
    parsed.authentication?.idToken ||
    manual.idToken ||
    undefined;

  const authCode = parsed.params?.code || manual.code;

  if (!idToken && authCode && !expoGo) {
    try {
      idToken = await exchangeCodeForIdToken(request, authCode, oauthRedirectUri, clientId);
    } catch (error) {
      console.error('[Google Sign-In] code exchange failed:', error);
      return {
        ok: false,
        reason: 'exchange_failed',
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  if (!idToken) {
    return {
      ok: false,
      reason: 'no_token',
      detail: expoGo
        ? 'Google لم يرجع id_token — تأكد من تفعيل Google في Firebase'
        : 'لم يُستلم id_token',
    };
  }

  logGoogle('success', { idTokenLength: idToken.length });
  return { ok: true, idToken };
}

export async function promptGoogleSignIn(): Promise<GoogleSignInResult> {
  try {
    const session = await buildGoogleSession();
    return finishGoogleSignIn(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'missing_client') {
      return { ok: false, reason: 'missing_client', detail: 'googleWebClientId فارغ' };
    }
    if (message === 'project_name') {
      return { ok: false, reason: 'project_name', detail: 'owner/slug غير موجود في app.json' };
    }
    return { ok: false, reason: 'failed', detail: message };
  }
}

export function googleSignInErrorMessage(result: Extract<GoogleSignInResult, { ok: false }>): string {
  switch (result.reason) {
    case 'cancelled':
      return 'تم إلغاء تسجيل Google';
    case 'no_token':
      return 'لم يتم استلام توكن Google';
    case 'missing_client':
      return 'أضف googleWebClientId في app.json';
    case 'oauth_error':
    case 'exchange_failed':
    case 'browser_failed':
      return result.detail || 'تعذر إكمال تسجيل Google';
    default:
      return result.detail || 'تعذر تسجيل الدخول عبر Google';
  }
}
