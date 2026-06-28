import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, FontSize, Spacing, BorderRadius } from '../lib/theme';
import { useApp } from '../context/AppProvider';
import { getNextOpenMessage, getStoreHoursLabel } from '../lib/storeHours';

interface StoreClosedOverlayProps {
  onBrowse?: () => void;
}

export default function StoreClosedOverlay({ onBrowse }: StoreClosedOverlayProps) {
  const navigation = useNavigation<any>();
  const { storeSettings, isStoreOpen, getCartCount } = useApp();
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (isStoreOpen) setDismissed(false);
  }, [isStoreOpen]);

  if (isStoreOpen || dismissed) return null;

  const cartCount = getCartCount();
  const hoursLabel = getStoreHoursLabel(storeSettings);
  const nextOpen = getNextOpenMessage(storeSettings);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="moon" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.title}>المتجر مغلق حالياً</Text>
          <Text style={styles.subtitle}>
            نستقبل الطلبات من {hoursLabel} بتوقيت بغداد
          </Text>
          {nextOpen ? <Text style={styles.hint}>{nextOpen}</Text> : null}

          {cartCount > 0 ? (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                setDismissed(true);
                navigation.navigate('MainTabs', { screen: 'CartTab' });
              }}
            >
              <Ionicons name="calendar-outline" size={20} color={Colors.white} />
              <Text style={styles.primaryBtnText}>جدولة طلب ({cartCount} منتج)</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              setDismissed(true);
              onBrowse?.();
            }}
          >
            <Text style={styles.secondaryBtnText}>تصفح المنتجات فقط</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textDark,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 22,
  },
  hint: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    marginTop: Spacing.sm,
  },
  primaryBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: FontSize.md,
  },
  secondaryBtn: {
    paddingVertical: Spacing.md,
  },
  secondaryBtnText: {
    color: Colors.textGray,
    fontWeight: '600',
    fontSize: FontSize.sm,
  },
});
