import AsyncStorage from '@react-native-async-storage/async-storage';

type AuthState = { isAuthenticated: boolean };
type AuthListener = (state: AuthState) => void;

const listeners = new Set<AuthListener>();

async function getAuthState(): Promise<AuthState> {
  const refreshToken = await AsyncStorage.getItem('firebase_refresh_token');
  return { isAuthenticated: !!refreshToken };
}

function notifyListeners(state: AuthState) {
  listeners.forEach((listener) => listener(state));
}

export const a0 = {
  auth: {
    onAuthStateChanged(listener: AuthListener) {
      getAuthState().then((state) => {
        listener(state);
      });
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async signInWithGoogle() {
      throw new Error(
        'تسجيل Google يتطلب a0-sdk من منصة a0.dev. استخدم «دخول كزائر» للتجربة محلياً.'
      );
    },

    async signOut() {
      notifyListeners({ isAuthenticated: false });
    },
  },
};
