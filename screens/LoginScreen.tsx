import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Platform,
  type TextInput as TextInputType,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing, getFooterBottomPadding } from '../lib/theme';
import { useApp } from '../context/AppProvider';
import GlassBackground from '../components/GlassBackground';
import AppBrandLogo from '../components/AppBrandLogo';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { requestOtp, verifyOtp, showToast } = useApp();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [normalizedPhone, setNormalizedPhone] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phoneInputRef = useRef<TextInputType>(null);
  const codeInputRef = useRef<TextInputType>(null);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (step === 'phone') phoneInputRef.current?.focus();
      else codeInputRef.current?.focus();
    }, 350);
    return () => clearTimeout(timer);
  }, [step]);

  const startResendCooldown = (seconds = 60) => {
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    setResendCooldown(seconds);
    cooldownTimerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          cooldownTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRequestOtp = async () => {
    if (loading) return;
    if (resendCooldown > 0) {
      showToast(`انتظر ${resendCooldown} ثانية قبل إعادة الإرسال`);
      return;
    }
    if (!phone.trim()) {
      showToast('أدخل رقم الهاتف');
      phoneInputRef.current?.focus();
      return;
    }
    setLoading(true);
    const result = await requestOtp(phone);
    setLoading(false);
    if (!result.ok || !result.phone) return;
    startResendCooldown(60);
    setNormalizedPhone(result.phone);
    if (result.devCode) setCode(result.devCode);
    setStep('code');
  };

  const handleVerifyOtp = async () => {
    if (loading) return;
    if (code.trim().length < 4) {
      showToast('أدخل رمز التحقق');
      codeInputRef.current?.focus();
      return;
    }
    setLoading(true);
    await verifyOtp(normalizedPhone || phone, code);
    setLoading(false);
  };

  return (
    <GlassBackground>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + 60,
            paddingBottom: getFooterBottomPadding(insets.bottom, { extra: Spacing.xl }),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        bounces={false}
      >
        <View style={styles.logoSpacer} pointerEvents="none">
          <AppBrandLogo size={120} />
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>تسجيل الدخول</Text>
          <Text style={styles.subtitle}>
            {step === 'phone'
              ? 'أدخل رقم هاتفك حتى نرسل رمز التحقق'
              : `أدخل الرمز المرسل إلى ${normalizedPhone || phone}`}
          </Text>

          {step === 'phone' ? (
            <View>
              <Text style={styles.label}>رقم الهاتف</Text>
              <Pressable
                style={styles.inputWrap}
                onPress={() => phoneInputRef.current?.focus()}
                accessibilityRole="none"
              >
                <View pointerEvents="none">
                  <Ionicons name="call-outline" size={21} color={Colors.primary} />
                </View>
                <TextInput
                  ref={phoneInputRef}
                  style={[styles.input, styles.ltrField]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="0780xxxxxxx"
                  placeholderTextColor={Colors.textGray}
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  autoComplete="tel"
                  importantForAutofill="yes"
                  // Digits are LTR — right-align + forced RTL breaks caret/focus on some iOS builds
                  textAlign="left"
                  autoCorrect={false}
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={14}
                  editable={!loading}
                  autoFocus
                  blurOnSubmit={false}
                  returnKeyType="done"
                  onSubmitEditing={handleRequestOtp}
                  accessibilityLabel="رقم الهاتف"
                />
              </Pressable>
              <TouchableOpacity
                style={[styles.primaryBtn, resendCooldown > 0 && styles.btnDisabled]}
                onPress={handleRequestOtp}
                activeOpacity={0.85}
                disabled={loading || resendCooldown > 0}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="chatbubble-ellipses-outline" size={22} color={Colors.white} />
                    <Text style={styles.primaryText}>
                      {resendCooldown > 0
                        ? `إعادة الإرسال بعد ${resendCooldown} ث`
                        : 'إرسال رمز التحقق'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={styles.label}>رمز التحقق</Text>
              <TextInput
                ref={codeInputRef}
                style={[styles.codeInput, styles.ltrField]}
                value={code}
                onChangeText={setCode}
                placeholder="000000"
                placeholderTextColor={Colors.textGray}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                textAlign="center"
                autoCorrect={false}
                maxLength={6}
                editable={!loading}
                autoFocus
                blurOnSubmit={false}
                returnKeyType="done"
                onSubmitEditing={handleVerifyOtp}
                accessibilityLabel="رمز التحقق"
              />
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleVerifyOtp}
                activeOpacity={0.85}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark-outline" size={22} color={Colors.white} />
                    <Text style={styles.primaryText}>تحقق ودخول</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={handleRequestOtp}
                disabled={loading || resendCooldown > 0}
              >
                <Text style={[styles.backText, resendCooldown > 0 && styles.backTextMuted]}>
                  {resendCooldown > 0
                    ? `إعادة إرسال الرمز بعد ${resendCooldown} ث`
                    : 'إعادة إرسال الرمز'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => {
                  setStep('phone');
                  setCode('');
                }}
                disabled={loading}
              >
                <Text style={styles.backText}>تغيير رقم الهاتف</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  logoSpacer: {
    alignItems: 'center',
    marginBottom: 42,
  },
  form: {
    padding: Spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    zIndex: 2,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.textDark,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textGray,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  label: {
    color: Colors.textDark,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
    textAlign: 'left',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    minHeight: 52,
  },
  input: {
    flex: 1,
    minHeight: 48,
    paddingVertical: Platform.OS === 'ios' ? Spacing.md : Spacing.sm,
    color: Colors.textDark,
    fontSize: FontSize.md,
    letterSpacing: 0,
  },
  ltrField: {
    writingDirection: 'ltr',
  },
  codeInput: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    minHeight: 52,
    paddingVertical: Spacing.md,
    color: Colors.textDark,
    fontSize: FontSize.xl,
    fontWeight: '600',
    letterSpacing: 4,
    marginBottom: Spacing.lg,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryText: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.white,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  backBtn: {
    alignItems: 'center',
    padding: Spacing.md,
  },
  backText: {
    color: Colors.primaryDark,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
  },
  backTextMuted: {
    color: Colors.textGray,
  },
});
