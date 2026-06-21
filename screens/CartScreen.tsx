import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors, FontSize, Spacing, BorderRadius } from '../lib/theme';
import { useApp } from '../context/AppProvider';
import { fetchCollection } from '../lib/firebase';
import GlassBackground from '../components/GlassBackground';
import CartItemCard from '../components/CartItemCard';
import { AppHeader } from '../components/layout';

const PROFILE_KEY = 'customer_profile_v1';
const LEGACY_PROFILE_KEY = 'user_profile';
const STATUS_LABELS: Record<string, string> = {
  pending: 'قيد الانتظار',
  accepted: 'تم قبول طلبك',
  preparing: 'طلبك تحت التجهيز',
  on_the_way: 'طلبك في التوصيل',
};
const ORDER_EXPIRE_MS = 6 * 60 * 60 * 1000;
const MAX_VISIBLE_ORDERS = 3;
const CART_ONLY_STATUSES = new Set(['pending', 'preparing']);

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { cart, clearCart, getCartCount, getCartTotals, submitOrder, showToast, userPhone } = useApp();

  const [showCheckout, setShowCheckout] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [latestOrders, setLatestOrders] = useState<any[]>([]);
  const [hiddenOrderIds, setHiddenOrderIds] = useState<string[]>([]);

  const cartCount = getCartCount();
  const totals = getCartTotals();
  const isPhoneValid = phone.length >= 10;

  const getOrderTime = useCallback((order: any) => {
    const raw = order?.statusUpdatedAt || order?.createdAt;
    const time = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
  }, []);

  const loadLatestOrder = useCallback(async () => {
    try {
      const savedProfile = (await AsyncStorage.getItem(PROFILE_KEY)) || (await AsyncStorage.getItem(LEGACY_PROFILE_KEY));
      if (!savedProfile) {
        setLatestOrders([]);
        return;
      }
      const profile = JSON.parse(savedProfile);
      if (!profile?.name || !profile?.phone) {
        setLatestOrders([]);
        return;
      }

      const orders = await fetchCollection('orders');
      const matchedOrders = orders
        .filter((order: any) => order.name === profile.name && order.phone === profile.phone)
        .filter((order: any) => CART_ONLY_STATUSES.has(order.status))
        .sort((a: any, b: any) => getOrderTime(b) - getOrderTime(a))
        .filter((order: any) => !(order.status === 'on_the_way' && Date.now() - getOrderTime(order) > ORDER_EXPIRE_MS))
        .slice(0, MAX_VISIBLE_ORDERS);

      setLatestOrders(matchedOrders);
      setHiddenOrderIds((prev: string[]) => prev.filter((id: string) => matchedOrders.some((order: any) => order.id === id)));
    } catch {
      setLatestOrders([]);
    }
  }, [getOrderTime]);

  useEffect(() => {
    loadProfile();
    loadLatestOrder();
    const timer = setInterval(loadLatestOrder, 30000);
    return () => clearInterval(timer);
  }, [loadLatestOrder]);

  useEffect(() => {
    if (showCheckout) {
      loadProfile();
    }
  }, [showCheckout]);

  const loadProfile = async () => {
    try {
      const savedProfile = (await AsyncStorage.getItem(PROFILE_KEY)) || (await AsyncStorage.getItem(LEGACY_PROFILE_KEY));
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        setName(parsed.name || '');
        setPhone(parsed.phone || userPhone || '');
        setAddress(parsed.address || '');
      } else if (userPhone) {
        setPhone(userPhone);
      }
    } catch (e) {}
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      showToast('السلة فارغة!');
      return;
    }
    loadProfile().then(() => setShowCheckout(true)).catch(() => setShowCheckout(true));
  };

  const handleConfirmOrder = async () => {
    if (!name.trim() || !phone.trim() || !address.trim()) {
      showToast('يرجى إكمال البيانات');
      return;
    }
    if (!isPhoneValid) {
      showToast('رقم الهاتف غير صحيح');
      return;
    }

    try {
      const profile = { name: name.trim(), phone: phone.trim(), address: address.trim() };
      await AsyncStorage.multiSet([
        [PROFILE_KEY, JSON.stringify(profile)],
        [LEGACY_PROFILE_KEY, JSON.stringify(profile)],
      ]);
    } catch (e) {}

    setSubmitting(true);
    const success = await submitOrder(name.trim(), phone.trim(), address.trim());
    setSubmitting(false);

    if (success) {
      showToast('تم تأكيد الطلب بنجاح!');
      setShowCheckout(false);
      loadLatestOrder();
      navigation.goBack();
    } else {
      showToast('حدث خطأ، حاول مرة أخرى');
    }
  };

  return (
    <GlassBackground>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <AppHeader
          title="سلة التسوق"
          subtitle={`${cartCount} منتج`}
          showBack
          rightSlot={
            <TouchableOpacity onPress={clearCart} style={styles.clearBtn}>
              <Ionicons name="trash-outline" size={20} color={Colors.danger} />
            </TouchableOpacity>
          }
        />

        {latestOrders.length > 0 ? (
          <View style={styles.orderBannerStack}>
            {latestOrders
              .filter((order: any) => !hiddenOrderIds.includes(order.id))
              .map((order: any) => {
                const itemNames = (order.items || []).map((item: any) => item.name).filter(Boolean);
                return (
                  <View key={order.id} style={styles.orderBanner}>
                    <View style={styles.orderBannerIcon}>
                      <Ionicons name="receipt-outline" size={20} color={Colors.white} />
                    </View>
                    <View style={styles.orderBannerBody}>
                      <Text style={styles.orderBannerText} numberOfLines={1}>
                        {STATUS_LABELS[order.status] || 'تم تحديث الطلب'}
                      </Text>
                      <Text style={styles.orderBannerSubText} numberOfLines={1}>
                        {itemNames.length > 0 ? itemNames.join('، ') : 'تم إرسال الطلب إلى النظام'}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setHiddenOrderIds((prev: string[]) => [...prev, order.id])} style={styles.orderBannerClose}>
                      <Ionicons name="close" size={18} color={Colors.textDark} />
                    </TouchableOpacity>
                  </View>
                );
              })}
          </View>
        ) : null}

        {showCheckout ? (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.checkoutScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.checkoutTitle}>معلومات التوصيل</Text>

            <Text style={styles.inputLabel}>الاسم الكامل</Text>
            <TextInput
              style={styles.input}
              placeholder="اكتب اسمك الكامل"
              placeholderTextColor="rgba(0,0,0,0.35)"
              value={name}
              onChangeText={setName}
              textAlign="right"
            />

            <Text style={styles.inputLabel}>رقم الهاتف</Text>
            <TextInput
              style={styles.input}
              placeholder="اكتب رقم الهاتف"
              placeholderTextColor="rgba(0,0,0,0.35)"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              textAlign="right"
            />

            <Text style={styles.inputLabel}>عنوان التوصيل</Text>
            <TextInput
              style={styles.input}
              placeholder="اكتب العنوان بالتفصيل"
              placeholderTextColor="rgba(0,0,0,0.35)"
              value={address}
              onChangeText={setAddress}
              textAlign="right"
            />

            <View style={styles.checkoutButtons}>
              <TouchableOpacity
                style={[styles.confirmBtn, (!isPhoneValid || submitting) && styles.btnDisabled]}
                onPress={handleConfirmOrder}
                disabled={!isPhoneValid || submitting}
              >
                <Text style={styles.payBtnText}>
                  {submitting ? 'جاري الإرسال...' : 'تأكيد الطلب'}
                </Text>
                {!submitting && <Ionicons name="checkmark" size={20} color={Colors.white} />}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowCheckout(false)}
              >
                <Text style={styles.cancelBtnText}>رجوع</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        ) : (
          <>
            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentInner}
              showsVerticalScrollIndicator={false}
            >
              {cart.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="cart-outline" size={60} color={Colors.textLight} />
                  <Text style={styles.emptyText}>السلة فارغة</Text>
                </View>
              ) : (
                cart.map((item: any) => (
                  <View key={item.id}>
                    <CartItemCard item={item} />
                  </View>
                ))
              )}
              <View style={{ height: 280 }} />
            </ScrollView>

            <View style={[styles.summary, { paddingBottom: insets.bottom + Spacing.md }]}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>الطلبات</Text>
                <Text style={styles.summaryValue}>{totals.subtotal.toLocaleString()} د.ع</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: Colors.discount }]}>الخصم</Text>
                <Text style={[styles.summaryValue, { color: Colors.discount }]}>{totals.discount.toLocaleString()} د.ع</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>التوصيل</Text>
                <Text style={styles.summaryValue}>{totals.delivery.toLocaleString()} د.ع</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>الإجمالي</Text>
                <Text style={styles.totalValue}>{totals.total.toLocaleString()} د.ع</Text>
              </View>
              <TouchableOpacity style={styles.payBtn} onPress={handleCheckout}>
                <Text style={styles.payBtnText}>الدفع</Text>
                <Ionicons name="cash-outline" size={20} color={Colors.white} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  clearBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFD6D6',
  },
  orderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.98)',
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.sm,
    marginBottom: 0,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    minHeight: 70,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  orderBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  orderBannerBody: {
    flex: 1,
  },
  orderBannerText: {
    textAlign: 'right',
    color: Colors.textDark,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
  },
  orderBannerSubText: {
    textAlign: 'right',
    color: Colors.textGray,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  orderBannerClose: {
    padding: 6,
  },
  orderBannerStack: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    gap: Spacing.lg,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textGray,
    fontSize: FontSize.md,
  },
  summary: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.glassBackground,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    color: Colors.textDark,
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  summaryValue: {
    color: Colors.textDark,
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  totalLabel: {
    fontWeight: 'bold',
    fontSize: FontSize.lg,
    color: Colors.textDark,
  },
  totalValue: {
    fontWeight: 'bold',
    fontSize: FontSize.lg,
    color: Colors.primary,
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  payBtnText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: FontSize.lg,
  },
  checkoutForm: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.glassBackground,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  checkoutTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.textDark,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textDark,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    writingDirection: 'rtl',
  },
  checkoutButtons: {
    gap: Spacing.sm,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  cancelBtnText: {
    color: Colors.textGray,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  gateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  gateTitle: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.textDark,
    textAlign: 'center',
  },
  gateSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textGray,
    textAlign: 'center',
  },
  gateGoogleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginTop: Spacing.sm,
  },
  gateGoogleText: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.textDark,
  },
  gateBackText: {
    fontSize: FontSize.md,
    color: Colors.textGray,
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: FontSize.md,
    fontWeight: 'bold',
    color: Colors.textDark,
    marginBottom: Spacing.xs,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  checkoutScrollContent: {
    padding: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  orderBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
});