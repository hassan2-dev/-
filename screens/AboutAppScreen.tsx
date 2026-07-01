import React from 'react';
import { Text, StyleSheet, ScrollView, View } from 'react-native';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { Colors, FontSize, Spacing, Layout } from '../lib/theme';
import GlassBackground from '../components/GlassBackground';
import { AppHeader } from '../components/layout';

const appVersion = Constants.expoConfig?.version ?? '1.0.1';
const buildNumber = Constants.nativeBuildVersion;
const versionLabel = buildNumber ? `${appVersion} (${buildNumber})` : appVersion;

export default function AboutAppScreen() {
  const navigation = useNavigation();

  return (
    <GlassBackground>
      <AppHeader title="حول التطبيق" showBack onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>حول التطبيق</Text>

        <Text style={styles.paragraph}>هذا التطبيق هو متجر إلكتروني يتيح للمستخدمين تصفح المنتجات وطلبها بسهولة.</Text>

        <Text style={styles.subTitle}>المميزات:</Text>

        <Text style={styles.bulletItem}>• تصفح المنتجات</Text>
        <Text style={styles.bulletItem}>• إضافة إلى السلة</Text>
        <Text style={styles.bulletItem}>• المفضلة</Text>
        <Text style={styles.bulletItem}>• إرسال الطلبات</Text>

        <Text style={styles.version}>الإصدار: {versionLabel}</Text>

        <View style={styles.divider} />

        <Text style={styles.sectionTitleEn}>About the App</Text>

        <Text style={styles.paragraphEn}>This app is an e-commerce store that allows users to browse and order products easily.</Text>

        <Text style={styles.subTitleEn}>Features:</Text>

        <Text style={styles.bulletItemEn}>• Product browsing</Text>
        <Text style={styles.bulletItemEn}>• Cart system</Text>
        <Text style={styles.bulletItemEn}>• Favorites</Text>
        <Text style={styles.bulletItemEn}>• Order submission</Text>

        <Text style={styles.versionEn}>Version: {versionLabel}</Text>

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
  subTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textDark,
    marginBottom: Spacing.sm,
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
  version: {
    fontSize: FontSize.md,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: Spacing.lg,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.glassBorder,
    marginVertical: Spacing.xl,
  },
  sectionTitleEn: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.textDark,
    marginBottom: Spacing.lg,
    textAlign: 'left',
  },
  paragraphEn: {
    fontSize: FontSize.md,
    color: Colors.textDark,
    lineHeight: 26,
    marginBottom: Spacing.md,
    textAlign: 'left',
  },
  subTitleEn: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textDark,
    marginBottom: Spacing.sm,
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
  versionEn: {
    fontSize: FontSize.md,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: Spacing.lg,
    textAlign: 'left',
  },
});
