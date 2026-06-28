import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Colors, FontSize, Spacing, BorderRadius } from '../lib/theme';
import { useApp } from '../context/AppProvider';
import { fetchCollection } from '../lib/firebase';
import { isValidIraqiPhone, normalizeIraqiPhone } from '../lib/phone';
import { rtlInput } from '../lib/rtl';
import {
  baghdadDateTimeToISO,
  formatScheduledArabic,
  getScheduleTimeSlots,
  getUpcomingBaghdadDates,
  getStoreHoursLabel,
  isScheduledTimeValid,
} from '../lib/storeHours';
import GlassBackground from '../components/GlassBackground';
import CartItemCard from '../components/CartItemCard';
import SavedAddressCard from '../components/SavedAddressCard';
import FormSection from '../components/FormSection';
import AddressConfirmModal from '../components/AddressConfirmModal';
import { AppHeader } from '../components/layout';
import {
  formatApartmentSummary,
} from '../lib/apartmentCode';
import { loadCustomerProfile, resolveApartmentFromProfile, saveCustomerProfile, getSavedAddressCode, hasSavedAddress } from '../lib/customerProfile';


const STATUS_LABELS: Record<string, string> = {
  pending: 'قيد الانتظار',
  accepted: 'تم قبول طلبك',
  preparing: 'طلبك تحت التجهيز',
  on_the_way: 'طلبك في التوصيل',
};
const ORDER_EXPIRE_MS = 6 * 60 * 60 * 1000;
const MAX_VISIBLE_ORDERS = 3;
const CART_ONLY_STATUSES = new Set(['pending', 'preparing']);

interface Props {
  mode?: 'tab' | 'stack';
}

export default function CartScreen({ mode = 'stack' }: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { cart, clearCart, getCartCount, getCartTotals, submitOrder, showToast, userPhone, isStoreOpen, storeSettings } = useApp();

  const [showCheckout, setShowCheckout] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [savedAddressCode, setSavedAddressCode] = useState('');
  const [addressSummary, setAddressSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAddressConfirm, setShowAddressConfirm] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<'now' | 'scheduled'>(isStoreOpen ? 'now' : 'scheduled');
  const [scheduledDateIndex, setScheduledDateIndex] = useState(0);
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [latestOrders, setLatestOrders] = useState<any[]>([]);
  const [hiddenOrderIds, setHiddenOrderIds] = useState<string[]>([]);

  const cartCount = getCartCount();
  const totals = getCartTotals();
  const isPhoneValid = isValidIraqiPhone(phone);
  const upcomingDates = useMemo(() => getUpcomingBaghdadDates(7), []);
  const timeSlots = useMemo(() => getScheduleTimeSlots(storeSettings), [storeSettings]);

  useEffect(() => {
    if (timeSlots.length > 0 && !timeSlots.includes(scheduledTime)) {
      setScheduledTime(timeSlots[0]);
    }
  }, [timeSlots, scheduledTime]);

  useEffect(() => {
    if (!isStoreOpen) setDeliveryMode('scheduled');
  }, [isStoreOpen]);

  const getOrderTime = useCallback((order: any) => {
    const raw = order?.statusUpdatedAt || order?.createdAt;
    const time = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
  }, []);

  const loadLatestOrder = useCallback(async () => {
    try {
      const profile = await loadCustomerProfile();
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

  const loadProfile = useCallback(async () => {
    try {
      const parsed = await loadCustomerProfile();
      if (parsed) {
        setName(parsed.name || '');
        setPhone(parsed.phone || userPhone || '');
        const code = getSavedAddressCode(parsed);
        setSavedAddressCode(code);
        if (code) {
          const apt = resolveApartmentFromProfile(parsed);
          setAddressSummary(apt ? formatApartmentSummary(apt) : '');
        } else {
          setAddressSummary('');
        }
      } else if (userPhone) {
        setPhone(userPhone);
        setSavedAddressCode('');
        setAddressSummary('');
      }
    } catch (e) {}
  }, [userPhone]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const handleCheckout = async () => {
    if (cart.length === 0) {
      showToast('السلة فارغة!');
      return;
    }

    try {
      const parsed = await loadCustomerProfile();
      if (parsed) {
        setName(parsed.name || '');
        setPhone(parsed.phone || userPhone || '');
        const code = getSavedAddressCode(parsed);
        setSavedAddressCode(code);
        if (code) {
          const apt = resolveApartmentFromProfile(parsed);
          setAddressSummary(apt ? formatApartmentSummary(apt) : '');
        } else {
          setAddressSummary('');
        }
      } else if (userPhone) {
        setPhone(userPhone);
      }

      if (!hasSavedAddress(parsed)) {
        showToast('يجب إضافة عنوان الشقة قبل إتمام الطلب');
        navigation.navigate('DeliveryAddress');
        return;
      }

      setShowCheckout(true);
    } catch {
      showToast('يجب إضافة عنوان الشقة قبل إتمام الطلب');
      navigation.navigate('DeliveryAddress');
    }
  };

  const deliveryNote = useMemo(() => {
    if (deliveryMode === 'scheduled') {
      const selectedDate = upcomingDates[scheduledDateIndex]?.label;
      return selectedDate && scheduledTime ? `جدولة: ${selectedDate} — ${scheduledTime}` : 'جدولة الطلب';
    }
    return isStoreOpen ? 'التوصيل في أقرب وقت' : undefined;
  }, [deliveryMode, upcomingDates, scheduledDateIndex, scheduledTime, isStoreOpen]);

  const handleConfirmOrder = () => {
    if (!name.trim() || !phone.trim() || !savedAddressCode) {
      if (!savedAddressCode) {
        showToast('يجب إضافة عنوان الشقة أولاً');
        navigation.navigate('DeliveryAddress');
      } else {
        showToast('أكمل الاسم والهاتف');
      }
      return;
    }
    const normalizedPhone = normalizeIraqiPhone(phone);
    if (!normalizedPhone) {
      showToast('رقم الهاتف غير صحيح — استخدم رقم عراقي (07XXXXXXXXX)');
      return;
    }

    if (deliveryMode === 'scheduled') {
      const selectedDate = upcomingDates[scheduledDateIndex]?.value;
      if (!selectedDate || !scheduledTime) {
        showToast('اختر وقت التوصيل المجدول');
        return;
      }
      const scheduledAt = baghdadDateTimeToISO(selectedDate, scheduledTime);
      if (!isScheduledTimeValid(storeSettings, new Date(scheduledAt))) {
        showToast('الوقت المختار خارج ساعات العمل أو قريب جداً');
        return;
      }
    } else if (!isStoreOpen) {
      showToast('المتجر مغلق — اختر جدولة الطلب');
      return;
    }

    setShowAddressConfirm(true);
  };

  const handleFinalSubmit = async () => {
    const normalizedPhone = normalizeIraqiPhone(phone);
    if (!normalizedPhone || !savedAddressCode) return;

    let scheduledAt: string | null = null;
    if (deliveryMode === 'scheduled') {
      const selectedDate = upcomingDates[scheduledDateIndex]?.value;
      if (!selectedDate || !scheduledTime) return;
      scheduledAt = baghdadDateTimeToISO(selectedDate, scheduledTime);
    }

    const addressCode = savedAddressCode;

    await saveCustomerProfile({
      name: name.trim(),
      phone: normalizedPhone,
      address: addressCode,
      apartment: resolveApartmentFromProfile({ address: addressCode }) ?? undefined,
    });

    setSubmitting(true);
    const success = await submitOrder(name.trim(), normalizedPhone, addressCode, scheduledAt);
    setSubmitting(false);
    setShowAddressConfirm(false);

    if (success) {
      setShowCheckout(false);
      loadLatestOrder();
      navigation.navigate('OrderThankYou', {
        scheduledLabel:
          deliveryMode === 'scheduled' && scheduledAt
            ? formatScheduledArabic(scheduledAt)
            : undefined,
      });
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
          subtitle={
            cartCount > 0
              ? `${cartCount} منتج · ${totals.total.toLocaleString()} د.ع`
              : 'سلتك فارغة'
          }
          showBack={mode !== 'tab'}
          showCart={false}
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
            <Text style={styles.checkoutSubtitle}>راجع بياناتك وعنوانك قبل تأكيد الطلب</Text>

            <FormSection icon="person-outline" title="بياناتك" subtitle="الاسم ورقم الهاتف للتواصل">
              <Text style={styles.inputLabel}>الاسم الكامل</Text>
              <TextInput
                style={[styles.input, rtlInput]}
                placeholder="اكتب اسمك الكامل"
                placeholderTextColor="rgba(0,0,0,0.35)"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.inputLabel}>رقم الهاتف</Text>
              <TextInput
                style={[styles.input, rtlInput]}
                placeholder="07XXXXXXXXX"
                placeholderTextColor="rgba(0,0,0,0.35)"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              {!isPhoneValid && phone.length > 0 ? (
                <Text style={styles.fieldHint}>أدخل رقم عراقي صحيح يبدأ بـ 07</Text>
              ) : null}
            </FormSection>

            <FormSection
              icon="location-outline"
              title="عنوان الشقة"
              subtitle={savedAddressCode ? 'العنوان محفوظ — اضغط للتعديل' : 'مطلوب قبل تأكيد الطلب'}
              accent={!savedAddressCode}
            >
              <SavedAddressCard
                embedded
                addressCode={savedAddressCode}
                summary={addressSummary}
                onPress={() => navigation.navigate('DeliveryAddress')}
              />
              {!savedAddressCode ? (
                <View style={styles.addressAlert}>
                  <Ionicons name="alert-circle-outline" size={16} color={Colors.primary} />
                  <Text style={styles.addressAlertText}>حدد عنوان الشقة من صفحة العنوان</Text>
                </View>
              ) : null}
            </FormSection>

            <FormSection icon="time-outline" title="وقت التوصيل" subtitle="الآن أو جدولة لوقت لاحق">
              {!isStoreOpen ? (
                <View style={styles.closedNotice}>
                  <Ionicons name="moon-outline" size={18} color={Colors.primary} />
                  <Text style={styles.closedNoticeText}>
                    المتجر مغلق — ساعات العمل: {getStoreHoursLabel(storeSettings)}
                  </Text>
                </View>
              ) : null}

              <View style={styles.modeRow}>
                <TouchableOpacity
                  style={[styles.modeBtn, deliveryMode === 'now' && styles.modeBtnActive, !isStoreOpen && styles.modeBtnDisabled]}
                  onPress={() => isStoreOpen && setDeliveryMode('now')}
                  disabled={!isStoreOpen}
                >
                  <Ionicons name="flash-outline" size={18} color={deliveryMode === 'now' ? Colors.white : Colors.textGray} />
                  <Text style={[styles.modeBtnText, deliveryMode === 'now' && styles.modeBtnTextActive]}>الآن</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeBtn, deliveryMode === 'scheduled' && styles.modeBtnActive]}
                  onPress={() => setDeliveryMode('scheduled')}
                >
                  <Ionicons name="calendar-outline" size={18} color={deliveryMode === 'scheduled' ? Colors.white : Colors.textGray} />
                  <Text style={[styles.modeBtnText, deliveryMode === 'scheduled' && styles.modeBtnTextActive]}>جدولة</Text>
                </TouchableOpacity>
              </View>

              {deliveryMode === 'scheduled' ? (
                <>
                  <Text style={styles.scheduleLabel}>اليوم</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {upcomingDates.map((day, index) => (
                      <TouchableOpacity
                        key={day.value}
                        style={[styles.chip, scheduledDateIndex === index && styles.chipActive]}
                        onPress={() => setScheduledDateIndex(index)}
                      >
                        <Text style={[styles.chipText, scheduledDateIndex === index && styles.chipTextActive]}>
                          {day.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.scheduleLabel}>الوقت</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {timeSlots.map((slot) => (
                      <TouchableOpacity
                        key={slot}
                        style={[styles.chip, scheduledTime === slot && styles.chipActive]}
                        onPress={() => setScheduledTime(slot)}
                      >
                        <Text style={[styles.chipText, scheduledTime === slot && styles.chipTextActive]}>
                          {slot}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              ) : null}
            </FormSection>

            <View style={styles.checkoutButtons}>
              <TouchableOpacity
                style={[styles.confirmBtn, (!isPhoneValid || !savedAddressCode || submitting) && styles.btnDisabled]}
                onPress={handleConfirmOrder}
                disabled={!isPhoneValid || !savedAddressCode || submitting}
              >
                <Text style={styles.payBtnText}>
                  {submitting
                    ? 'جاري الإرسال...'
                    : deliveryMode === 'scheduled'
                      ? 'مراجعة وتأكيد الطلب'
                      : 'مراجعة وتأكيد الطلب'}
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

      <AddressConfirmModal
        visible={showAddressConfirm}
        addressCode={savedAddressCode}
        addressSummary={addressSummary}
        deliveryNote={deliveryNote}
        confirming={submitting}
        onConfirm={handleFinalSubmit}
        onEditAddress={() => {
          setShowAddressConfirm(false);
          navigation.navigate('DeliveryAddress');
        }}
        onCancel={() => setShowAddressConfirm(false)}
      />
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
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textDark,
    textAlign: 'right',
    marginBottom: Spacing.xs,
  },
  checkoutSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textGray,
    textAlign: 'right',
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  addressAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  addressAlertText: {
    flex: 1,
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primaryDark,
    textAlign: 'right',
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
  fieldHint: {
    color: Colors.danger,
    fontSize: FontSize.xs,
    textAlign: 'right',
    marginTop: -Spacing.md,
    marginBottom: Spacing.md,
  },
  closedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  closedNoticeText: {
    flex: 1,
    color: Colors.primaryDark,
    fontSize: FontSize.sm,
    textAlign: 'right',
    fontWeight: '600',
  },
  modeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.inputBg,
  },
  modeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modeBtnDisabled: {
    opacity: 0.45,
  },
  modeBtnText: {
    fontWeight: '700',
    color: Colors.textGray,
    fontSize: FontSize.sm,
  },
  modeBtnTextActive: {
    color: Colors.white,
  },
  scheduleLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textDark,
    textAlign: 'right',
    marginBottom: Spacing.sm,
  },
  chipRow: {
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.inputBg,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textGray,
  },
  chipTextActive: {
    color: Colors.white,
  },
  checkoutScrollContent: {
    padding: Spacing.xl,
    paddingTop: Spacing.lg,
    gap: Spacing.lg,
  },
  orderBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
});