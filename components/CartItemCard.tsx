import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '../lib/theme';
import { CartItem } from '../lib/types';
import { useApp } from '../context/AppProvider';

interface Props {
  item: CartItem;
}

export default function CartItemCard({ item }: Props) {
  const { updateCartItemQty, removeFromCart } = useApp();

  return (
    <View style={styles.card}>
      <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
      <View style={styles.details}>
        <Text style={styles.name} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={styles.bottomRow}>
          <View>
            {item.hasDiscount && item.originalPrice ? (
              <Text style={styles.oldPrice}>
                {item.originalPrice.toLocaleString()} د.ع
              </Text>
            ) : null}
            <Text style={styles.price}>{item.price.toLocaleString()} د.ع</Text>
          </View>
          <View style={styles.qtyControl}>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => updateCartItemQty(item.id, -1)}
            >
              <Ionicons name="remove" size={16} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.qtyText}>{item.qty}</Text>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => updateCartItemQty(item.id, 1)}
            >
              <Ionicons name="add" size={16} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => removeFromCart(item.id)}>
        <Ionicons name="trash-outline" size={18} color={Colors.danger} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    alignItems: 'flex-start',
    ...Shadow.sm,
  },
  image: {
    width: 76,
    height: 76,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceMuted,
  },
  details: {
    flex: 1,
  },
  name: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: Spacing.sm,
    textAlign: 'right',
    lineHeight: 18,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  oldPrice: {
    textDecorationLine: 'line-through',
    color: Colors.textLight,
    fontSize: FontSize.xs,
    textAlign: 'right',
  },
  price: {
    fontWeight: '800',
    color: Colors.primary,
    fontSize: FontSize.md,
    textAlign: 'right',
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: BorderRadius.round,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  qtyText: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.textDark,
    minWidth: 20,
    textAlign: 'center',
  },
  deleteBtn: {
    padding: 4,
  },
});
