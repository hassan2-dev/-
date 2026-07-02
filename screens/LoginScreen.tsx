import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, getFooterBottomPadding } from '../lib/theme';
import { useApp } from '../context/AppProvider';
import GlassBackground from '../components/GlassBackground';
import AppBrandLogo from '../components/AppBrandLogo';
import { hasGoogleAuthConfig } from '../lib/authConfig';
import { promptGoogleSignIn, googleSignInErrorMessage } from '../lib/googleSignIn';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { finalizeGoogleSignIn, showToast } = useApp();
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleBusyRef = useRef(false);

  const handleGooglePress = async () => {
    if (googleBusyRef.current || googleLoading) return;

    if (!hasGoogleAuthConfig()) {
      showToast('أضف googleWebClientId في app.json من Firebase Console');
      return;
    }

    googleBusyRef.current = true;
    console.log('[Google Sign-In] button pressed');

    try {
      const result = await promptGoogleSignIn();
      if (!result.ok) {
        if (result.reason !== 'cancelled') {
          console.warn('[Google Sign-In] failed:', result.reason, result.detail);
          showToast(googleSignInErrorMessage(result));
        }
        return;
      }

      setGoogleLoading(true);
      const loggedIn = await finalizeGoogleSignIn(result.idToken);
      if (!loggedIn) {
        console.error('[Google Sign-In] Firebase rejected token');
      }
    } catch (error) {
      console.error('[Google Sign-In] unexpected error:', error);
      showToast('تعذر تسجيل الدخول عبر Google');
    } finally {
      googleBusyRef.current = false;
      setGoogleLoading(false);
    }
  };

  return (
    <GlassBackground>
      <View style={[styles.container, { paddingTop: insets.top + 80, paddingBottom: getFooterBottomPadding(insets.bottom, { extra: Spacing.xl }) }]}>
        <View style={styles.logoSpacer}>
          <AppBrandLogo size={120} />
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>تسجيل الدخول</Text>

          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGooglePress}
            activeOpacity={0.85}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator color="#DB4437" />
            ) : (
              <>
                <Ionicons name="logo-google" size={22} color="#DB4437" />
                <Text style={styles.googleText}>تسجيل عبر جوجل</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  logoSpacer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  form: {
    paddingHorizontal: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.textDark,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  googleText: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.textDark,
  },
});
