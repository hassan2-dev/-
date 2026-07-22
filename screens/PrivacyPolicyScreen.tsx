import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, FontSize, Spacing, Layout } from '../lib/theme';
import GlassBackground from '../components/GlassBackground';
import { AppHeader } from '../components/layout';

export default function PrivacyPolicyScreen() {
  const navigation = useNavigation();

  return (
    <GlassBackground>
      <AppHeader title="سياسة الخصوصية" showBack onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>سياسة الخصوصية</Text>

        <Text style={styles.paragraph}>نحن نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية.</Text>

        <Text style={styles.paragraph}>يقوم هذا التطبيق بجمع بعض المعلومات الأساسية لتحسين تجربة المستخدم، مثل:</Text>

        <Text style={styles.bulletItem}>• بيانات تسجيل الدخول (رقم الهاتف ورمز التحقق)</Text>
        <Text style={styles.bulletItem}>• معلومات الاستخدام داخل التطبيق</Text>
        <Text style={styles.bulletItem}>• بيانات الطلبات التي يقوم المستخدم بإرسالها</Text>

        <Text style={styles.paragraph}>يتم استخدام هذه البيانات فقط لغرض:</Text>

        <Text style={styles.bulletItem}>• تشغيل التطبيق بشكل صحيح</Text>
        <Text style={styles.bulletItem}>• معالجة الطلبات</Text>
        <Text style={styles.bulletItem}>• تحسين جودة الخدمة</Text>

        <Text style={styles.paragraph}>نحن لا نقوم ببيع أو مشاركة بيانات المستخدم مع أي طرف ثالث.</Text>

        <Text style={styles.paragraph}>
          يمكنك حذف حسابك وبياناتك الشخصية في أي وقت من داخل التطبيق عبر: حسابي ← حذف الحساب.
          عند الحذف يتم إزالة بياناتك نهائياً ولا يمكن استرجاعها.
        </Text>

        <Text style={styles.paragraph}>باستخدامك لهذا التطبيق، فإنك توافق على هذه السياسة.</Text>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Privacy Policy</Text>

        <Text style={styles.paragraphEn}>We respect your privacy and are committed to protecting your personal data.</Text>

        <Text style={styles.paragraphEn}>This application may collect basic information to improve user experience, including:</Text>

        <Text style={styles.bulletItemEn}>• Login information (phone number and OTP)</Text>
        <Text style={styles.bulletItemEn}>• Usage data</Text>
        <Text style={styles.bulletItemEn}>• Order data</Text>

        <Text style={styles.paragraphEn}>This data is used only to:</Text>

        <Text style={styles.bulletItemEn}>• Operate the app</Text>
        <Text style={styles.bulletItemEn}>• Process orders</Text>
        <Text style={styles.bulletItemEn}>• Improve the service</Text>

        <Text style={styles.paragraphEn}>We do not sell or share user data.</Text>

        <Text style={styles.paragraphEn}>
          You can permanently delete your account and personal data at any time from Account → Delete Account.
        </Text>

        <Text style={styles.paragraphEn}>By using this app, you agree to this policy.</Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.textDark,
    marginBottom: Spacing.lg,
    textAlign: 'right',
  },
  paragraph: {
    fontSize: FontSize.md,
    color: Colors.textDark,
    lineHeight: 26,
    marginBottom: Spacing.md,
    textAlign: 'right',
  },
  bulletItem: {
    fontSize: FontSize.md,
    color: Colors.textGray,
    lineHeight: 26,
    marginBottom: Spacing.xs,
    paddingRight: Spacing.md,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.glassBorder,
    marginVertical: Spacing.xl,
  },
  paragraphEn: {
    fontSize: FontSize.md,
    color: Colors.textDark,
    lineHeight: 26,
    marginBottom: Spacing.md,
    textAlign: 'left',
  },
  bulletItemEn: {
    fontSize: FontSize.md,
    color: Colors.textGray,
    lineHeight: 26,
    marginBottom: Spacing.xs,
    paddingLeft: Spacing.md,
    textAlign: 'left',
  },
});
