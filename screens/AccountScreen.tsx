import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Colors,
  FontSize,
  Spacing,
  BorderRadius,
  WHATSAPP_NUMBER,
  Layout,
  Shadow,
  getTabBarBottomPadding,
} from '../lib/theme';
import { useApp } from '../context/AppProvider';
import GlassBackground from '../components/GlassBackground';
import ScreenHeader from '../components/ScreenHeader';
import UserAvatar from '../components/UserAvatar';
import AppIcon from '../components/AppIcon';
import { resolveUserDisplayName } from '../lib/authConfig';
import { forwardIconName, rtlInput } from '../lib/rtl';
import { normalizeIraqiPhone } from '../lib/phone';
import SavedAddressCard from '../components/SavedAddressCard';
import {
  formatApartmentSummary,
} from '../lib/apartmentCode';
import { loadCustomerProfile, resolveApartmentFromProfile, saveCustomerProfile, getSavedAddressCode } from '../lib/customerProfile';


type MenuItem = {
  icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  badge?: string;
};

export default function AccountScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const tabBottomPadding = getTabBarBottomPadding(insets.bottom);
  const {
    logout,
    showToast,
    userPhone,
    userEmail,
    userDisplayName,
    userPhotoUrl,
    clearCacheAndRefresh,
    unreadNotificationCount,
  } = useApp();
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [savedAddressCode, setSavedAddressCode] = useState('');
  const [addressSummary, setAddressSummary] = useState('');

  const loadProfile = useCallback(async () => {
    const profile = await loadCustomerProfile();
    if (!profile) return;
    setName(profile.name || '');
    setPhone(profile.phone || userPhone || '');
    const code = getSavedAddressCode(profile);
    setSavedAddressCode(code);
    if (code) {
      const apt = resolveApartmentFromProfile(profile);
      setAddressSummary(apt ? formatApartmentSummary(apt) : '');
    } else {
      setAddressSummary('');
    }
  }, [userPhone]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const saveProfile = async () => {
    if (!name.trim() || !phone.trim()) {
      showToast('يرجى إكمال الاسم ورقم الهاتف');
      return;
    }
    const normalizedPhone = normalizeIraqiPhone(phone);
    if (!normalizedPhone) {
      showToast('رقم الهاتف غير صحيح — استخدم رقم عراقي (07XXXXXXXXX)');
      return;
    }
    try {
      const profile = await loadCustomerProfile();
      await saveCustomerProfile({
        name: name.trim(),
        phone: normalizedPhone,
        address: profile?.address,
        apartment: profile?.apartment,
      });
      showToast('تم حفظ البيانات');
      setShowProfileForm(false);
    } catch {
      showToast('تعذر حفظ البيانات');
    }
  };

  const profileName = resolveUserDisplayName(userDisplayName, userEmail);
  const headerSub = userEmail || userPhone || 'إدارة حسابك وطلباتك';

  const accountItems: MenuItem[] = [
    {
      icon: 'create-outline',
      label: 'الاسم والهاتف',
      onPress: () => setShowProfileForm((v) => !v),
    },
    {
      icon: 'location-outline',
      label: 'عنوان الشقة',
      onPress: () => navigation.navigate('DeliveryAddress'),
    },
    {
      icon: 'heart-outline',
      label: 'المفضلة',
      onPress: () => navigation.navigate('Favorites'),
    },
    {
      icon: 'notifications-outline',
      label: 'الإشعارات',
      badge: unreadNotificationCount > 0 ? String(unreadNotificationCount) : undefined,
      onPress: () => navigation.navigate('Notifications'),
    },
  ];

  const supportItems: MenuItem[] = [
    {
      icon: 'logo-whatsapp',
      label: 'تواصل معنا',
      onPress: () => Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}`),
    },
    {
      icon: 'refresh-outline',
      label: 'تحديث البيانات',
      onPress: () => clearCacheAndRefresh(),
    },
  ];

  const appItems: MenuItem[] = [
    {
      icon: 'shield-checkmark-outline',
      label: 'سياسة الخصوصية',
      onPress: () => navigation.navigate('PrivacyPolicy'),
    },
    {
      icon: 'information-circle-outline',
      label: 'حول التطبيق',
      onPress: () => navigation.navigate('AboutApp'),
    },
  ];

  const renderSection = (title: string, items: MenuItem[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.sectionCard}>
        {items.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.menuRow, index < items.length - 1 && styles.menuRowBorder]}
            onPress={item.onPress}
          >
            <View style={styles.menuIconWrap}>
              <AppIcon name={item.icon} size={20} color={Colors.primary} />
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
            {item.badge ? (
              <View style={styles.menuBadge}>
                <Text style={styles.menuBadgeText}>{item.badge}</Text>
              </View>
            ) : null}
            <AppIcon name={forwardIconName} size={16} color={Colors.textLight} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <GlassBackground>
      <ScreenHeader mode="page" title="حسابي" subtitle={headerSub} showCart={false} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentInner, { paddingBottom: tabBottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <UserAvatar photoUrl={userPhotoUrl} name={profileName} size={64} />
          <Text style={styles.profileName}>{profileName || 'زبون تفاحة'}</Text>
          <Text style={styles.profileSub}>{headerSub}</Text>
        </View>

        <View style={styles.addressBlock}>
          <SavedAddressCard
            addressCode={savedAddressCode}
            summary={addressSummary}
            onPress={() => navigation.navigate('DeliveryAddress')}
          />
        </View>

        {showProfileForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>الاسم ورقم الهاتف</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="الاسم الكامل"
              placeholderTextColor={Colors.textLight}
              style={[styles.input, rtlInput]}
            />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="07XXXXXXXXX"
              placeholderTextColor={Colors.textLight}
              keyboardType="phone-pad"
              style={[styles.input, rtlInput]}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveProfile}>
              <Text style={styles.saveBtnText}>حفظ</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {renderSection('حسابي', accountItems)}
        {renderSection('الدعم', supportItems)}
        {renderSection('التطبيق', appItems)}

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <AppIcon name="log-out-outline" size={20} color={Colors.danger} />
          <Text style={styles.logoutText}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </ScrollView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentInner: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.md,
  },
  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadow.sm,
  },
  profileName: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.textDark,
    marginTop: Spacing.md,
  },
  profileSub: {
    fontSize: FontSize.sm,
    color: Colors.textGray,
    marginTop: 4,
  },
  addressBlock: {
    marginBottom: Spacing.lg,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: Spacing.sm,
  },
  formTitle: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.textDark,
    textAlign: 'right',
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textDark,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  saveBtnText: { color: Colors.white, fontWeight: '800', fontSize: FontSize.md },
  section: { marginBottom: Spacing.lg },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.textGray,
    textAlign: 'right',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textDark,
    textAlign: 'right',
  },
  menuBadge: {
    backgroundColor: Colors.danger,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  menuBadgeText: { color: Colors.white, fontSize: 11, fontWeight: '800' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FFF5F5',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: '#FFD6D6',
    marginTop: Spacing.sm,
  },
  logoutText: { color: Colors.danger, fontWeight: '800', fontSize: FontSize.md },
});
