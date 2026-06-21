import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  TextInput,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import {
  Colors,
  FontSize,
  Spacing,
  BorderRadius,
  WHATSAPP_NUMBER,
  Layout,
  Shadow,
} from '../lib/theme';
import { useApp } from '../context/AppProvider';
import GlassBackground from '../components/GlassBackground';
import { AppHeader } from '../components/layout';

const PROFILE_KEY = 'customer_profile_v1';
const LEGACY_PROFILE_KEY = 'user_profile';

export default function AccountScreen() {
  const navigation = useNavigation<any>();
  const { logout, showToast, userPhone, clearCacheAndRefresh, unreadNotificationCount } = useApp();
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const saved =
          (await AsyncStorage.getItem(PROFILE_KEY)) ||
          (await AsyncStorage.getItem(LEGACY_PROFILE_KEY));
        if (!saved) return;
        const profile = JSON.parse(saved);
        setName(profile.name || '');
        setPhone(profile.phone || userPhone || '');
        setAddress(profile.address || '');
      } catch {
        // ignore
      }
    };
    loadProfile();
  }, [userPhone]);

  const saveProfile = async () => {
    try {
      const profile = {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
      };
      await AsyncStorage.multiSet([
        [PROFILE_KEY, JSON.stringify(profile)],
        [LEGACY_PROFILE_KEY, JSON.stringify(profile)],
      ]);
      showToast('تم حفظ الملف الشخصي');
    } catch {
      showToast('تعذر حفظ الملف الشخصي');
    }
  };

  const menuItems = [
    {
      icon: 'notifications-outline' as const,
      label: unreadNotificationCount > 0
        ? `الإشعارات (${unreadNotificationCount})`
        : 'الإشعارات',
      onPress: () => navigation.navigate('Notifications'),
    },
    {
      icon: 'refresh-outline' as const,
      label: 'تحديث البيانات (مسح الكاش)',
      onPress: () => clearCacheAndRefresh(),
    },
    {
      icon: 'chatbubble-ellipses-outline' as const,
      label: 'تواصل معنا',
      onPress: () => Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}`),
    },
    {
      icon: 'shield-checkmark-outline' as const,
      label: 'سياسة الخصوصية',
      onPress: () => navigation.navigate('PrivacyPolicy'),
    },
    {
      icon: 'information-circle-outline' as const,
      label: 'حول التطبيق',
      onPress: () => navigation.navigate('AboutApp'),
    },
  ];

  return (
    <GlassBackground>
      <AppHeader title="حسابي" />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[Colors.primary, Colors.primaryDark]}
          style={styles.profileHero}
        >
          <View style={styles.avatar}>
            <Ionicons name="person" size={36} color={Colors.white} />
          </View>
          <Text style={styles.userPhone}>{userPhone || 'مستخدم تفاحة'}</Text>
          <Text style={styles.userSub}>مرحباً بك في متجر تفاحة</Text>
        </LinearGradient>

        <TouchableOpacity
          style={styles.profileToggle}
          onPress={() => setShowProfileForm((v) => !v)}
        >
          <Ionicons name="create-outline" size={20} color={Colors.primary} />
          <Text style={styles.profileToggleText}>الملف الشخصي والتوصيل</Text>
          <Ionicons
            name={showProfileForm ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.textGray}
          />
        </TouchableOpacity>

        {showProfileForm ? (
          <View style={styles.profileCard}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="الاسم الكامل"
              placeholderTextColor={Colors.textLight}
              style={styles.input}
            />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="رقم الهاتف"
              placeholderTextColor={Colors.textLight}
              keyboardType="phone-pad"
              style={styles.input}
            />
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="عنوان التوصيل"
              placeholderTextColor={Colors.textLight}
              style={[styles.input, styles.textArea]}
              multiline
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveProfile}>
              <Text style={styles.saveText}>حفظ البيانات</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.menu}>
          {menuItems.map((item) => (
            <TouchableOpacity key={item.label} style={styles.menuItem} onPress={item.onPress}>
              <View style={styles.menuIcon}>
                <Ionicons name={item.icon} size={20} color={Colors.primary} />
              </View>
              <Text style={styles.menuText}>{item.label}</Text>
              <Ionicons name="chevron-back" size={18} color={Colors.textLight} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
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
    paddingBottom: Layout.tabBarHeight + Spacing.lg,
  },
  profileHero: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadow.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  userPhone: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.white,
  },
  userSub: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  profileToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.md,
  },
  profileToggleText: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textDark,
    textAlign: 'right',
  },
  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  saveText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: FontSize.md,
  },
  menu: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textDark,
    textAlign: 'right',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FFF0F0',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    borderWidth: 1,
    borderColor: '#FFD6D6',
  },
  logoutText: {
    color: Colors.danger,
    fontWeight: '800',
    fontSize: FontSize.md,
  },
});
