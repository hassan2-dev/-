import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Colors,
  BorderRadius,
  FontSize,
  Spacing,
  Layout,
  Shadow,
} from '../lib/theme';
import { useApp } from '../context/AppProvider';
import GlassBackground from '../components/GlassBackground';
import { isValidIraqiPhone } from '../lib/phone';

type Step = 'phone' | 'otp';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { requestOtp, verifyOtpAndLogin, showToast } = useApp();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (!isValidIraqiPhone(phone)) {
      showToast('أدخل رقم عراقي صحيح مثل 07XXXXXXXXX');
      return;
    }
    setLoading(true);
    try {
      const result = await requestOtp(phone);
      if (!result.ok) {
        showToast(result.message || 'تعذر إرسال الرمز');
        return;
      }
      setStep('otp');
      showToast('تم إرسال رمز التحقق');
      if (__DEV__) showToast(`رمز التحقق: ${result.devCode || '123456'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.trim().length !== 6) {
      showToast('أدخل رمزاً من 6 أرقام');
      return;
    }
    setLoading(true);
    try {
      await verifyOtpAndLogin(phone, otp);
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassBackground>
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LinearGradient
          colors={[Colors.primary, Colors.primaryDark]}
          style={styles.hero}
        >
          <View style={styles.logoCircle}>
            <Ionicons name="nutrition" size={44} color={Colors.white} />
          </View>
          <Text style={styles.appName}>تفاحة</Text>
          <Text style={styles.tagline}>تسوق خضروات وفواكه طازجة</Text>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.title}>تسجيل الدخول</Text>
          <Text style={styles.subtitle}>
            {step === 'phone'
              ? 'أدخل رقم هاتفك العراقي'
              : `رمز التحقق لـ ${phone}`}
          </Text>

          {step === 'phone' ? (
            <>
              <View style={styles.inputWrap}>
                <Text style={styles.prefix}>+964</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="7XX XXX XXXX"
                  placeholderTextColor={Colors.textLight}
                  keyboardType="phone-pad"
                  textAlign="right"
                  maxLength={14}
                />
                <Ionicons name="call-outline" size={20} color={Colors.primary} />
              </View>
              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={handleSendOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>إرسال رمز التحقق</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.otpRow}>
                <TextInput
                  style={styles.otpInput}
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="123456"
                  placeholderTextColor={Colors.textLight}
                  keyboardType="number-pad"
                  textAlign="center"
                  maxLength={6}
                />
              </View>
              <Text style={styles.otpHint}>رمز التجربة: 123456</Text>
              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={handleVerifyOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>تأكيد والدخول</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => {
                  setStep('phone');
                  setOtp('');
                }}
              >
                <Text style={styles.linkText}>تغيير الرقم</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    marginHorizontal: Layout.screenPadding,
    marginTop: Spacing.xl,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.xxxl,
    alignItems: 'center',
    ...Shadow.lg,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  appName: {
    fontSize: FontSize.title,
    fontWeight: '800',
    color: Colors.white,
  },
  tagline: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    marginTop: Spacing.xs,
  },
  card: {
    flex: 1,
    marginTop: Spacing.xxl,
    marginHorizontal: Layout.screenPadding,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadow.md,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textDark,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  prefix: {
    color: Colors.textGray,
    fontWeight: '700',
    fontSize: FontSize.md,
  },
  input: {
    flex: 1,
    fontSize: FontSize.lg,
    color: Colors.textDark,
    fontWeight: '600',
  },
  otpRow: {
    marginBottom: Spacing.sm,
  },
  otpInput: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.lg,
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textDark,
    letterSpacing: 12,
  },
  otpHint: {
    textAlign: 'center',
    color: Colors.textLight,
    fontSize: FontSize.xs,
    marginBottom: Spacing.lg,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: Colors.white,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  btnDisabled: { opacity: 0.7 },
  linkBtn: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  linkText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: FontSize.md,
  },
});
