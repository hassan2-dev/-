import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import GlassBackground from '../components/GlassBackground';
import { AppHeader } from '../components/layout';
import FormSection from '../components/FormSection';
import ApartmentAddressPicker from '../components/ApartmentAddressPicker';
import { Colors, FontSize, Spacing, BorderRadius, Layout } from '../lib/theme';
import { useApp } from '../context/AppProvider';
import {
  ApartmentSelection,
  DEFAULT_APARTMENT_SELECTION,
  buildApartmentCode,
  formatApartmentSummary,
  isApartmentSelectionComplete,
} from '../lib/apartmentCode';
import {
  loadCustomerProfile,
  resolveApartmentFromProfile,
  saveCustomerProfile,
} from '../lib/customerProfile';

export default function DeliveryAddressScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { showToast } = useApp();
  const [apartment, setApartment] = useState<Partial<ApartmentSelection>>({
    ...DEFAULT_APARTMENT_SELECTION,
  });
  const [saving, setSaving] = useState(false);

  const loadSaved = useCallback(async () => {
    const profile = await loadCustomerProfile();
    const resolved = resolveApartmentFromProfile(profile);
    setApartment(resolved ?? { ...DEFAULT_APARTMENT_SELECTION });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSaved();
    }, [loadSaved])
  );

  const isComplete = isApartmentSelectionComplete(apartment);
  const previewCode = isComplete ? buildApartmentCode(apartment) : '';

  const handleSave = async () => {
    if (!isComplete) {
      showToast('أكمل جميع خطوات العنوان');
      return;
    }
    setSaving(true);
    try {
      const profile = await loadCustomerProfile();
      const code = buildApartmentCode(apartment);
      await saveCustomerProfile({
        name: profile?.name,
        phone: profile?.phone,
        address: code,
        apartment: apartment as ApartmentSelection,
      });
      showToast('تم حفظ عنوان الشقة');
      navigation.goBack();
    } catch {
      showToast('تعذر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlassBackground>
      <AppHeader
        title="عنوان الشقة"
        subtitle="حدد موقعك في المجمع"
        showBack
        showCart={false}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FormSection
          icon="map-outline"
          title="موقع الشقة"
          subtitle="حدد موقع شقتك في المجمع — يُستخدم في كل طلباتك"
          accent
        >
          <ApartmentAddressPicker
            value={apartment}
            onChange={setApartment}
            autoSave={false}
            embedded
          />
        </FormSection>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
        {previewCode ? (
          <View style={styles.preview}>
            <View style={styles.previewRow}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.primaryDark} />
              <Text style={styles.previewLabel}>كود التوصيل</Text>
            </View>
            <Text style={styles.previewCode}>{previewCode}</Text>
            <Text style={styles.previewSummary}>
              {formatApartmentSummary(apartment as ApartmentSelection)}
            </Text>
          </View>
        ) : (
          <View style={styles.previewEmpty}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.textGray} />
            <Text style={styles.previewEmptyText}>أكمل الخطوات أعلاه لعرض كود التوصيل</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, (!isComplete || saving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!isComplete || saving}
        >
          <Ionicons name="save-outline" size={20} color={Colors.white} />
          <Text style={styles.saveBtnText}>{saving ? 'جاري الحفظ...' : 'حفظ العنوان'}</Text>
        </TouchableOpacity>
      </View>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentInner: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  footer: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.md,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  preview: {
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  previewLabel: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textGray,
  },
  previewCode: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: 1.5,
  },
  previewSummary: {
    fontSize: FontSize.xs,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 18,
  },
  previewEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  previewEmptyText: {
    fontSize: FontSize.sm,
    color: Colors.textGray,
    textAlign: 'right',
    flex: 1,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
});
