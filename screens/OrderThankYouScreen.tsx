import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import GlassBackground from '../components/GlassBackground';
import AppBrandLogo from '../components/AppBrandLogo';
import { Colors, FontSize, Spacing, BorderRadius } from '../lib/theme';

type RouteParams = {
  scheduledLabel?: string;
};

export default function OrderThankYouScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const scheduledLabel = (route.params as RouteParams | undefined)?.scheduledLabel;

  const goHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs', params: { screen: 'HomeTab' } }],
    });
  };

  return (
    <GlassBackground>
      <View style={[styles.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + Spacing.xl }]}>
        <AppBrandLogo size={120} />

        <View style={styles.messageBlock}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={36} color={Colors.white} />
          </View>
          <Text style={styles.thanks}>شكراً لطلبك!</Text>
          <Text style={styles.sub}>
            {scheduledLabel
              ? `تم جدولة طلبك بنجاح\n${scheduledLabel}`
              : 'تم استلام طلبك وسيتم تجهيزه وتوصيله إليك قريباً'}
          </Text>
        </View>

        <TouchableOpacity style={styles.homeBtn} onPress={goHome} activeOpacity={0.88}>
          <Ionicons name="home-outline" size={20} color={Colors.white} />
          <Text style={styles.homeBtnText}>العودة للرئيسية</Text>
        </TouchableOpacity>
      </View>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  messageBlock: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  thanks: {
    fontSize: FontSize.title,
    fontWeight: '800',
    color: Colors.textDark,
    textAlign: 'center',
  },
  sub: {
    fontSize: FontSize.md,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 26,
  },
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
  },
  homeBtnText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
});
