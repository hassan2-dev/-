import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '../lib/theme';
import { Product } from '../lib/types';
import { useApp } from '../context/AppProvider';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md) / 2;

interface Props {
  product: Product;
  onPress: () => void;
}

export default function ProductCard({ product, onPress }: Props) {
  const { addToCart, toggleFavorite, isFavorite } = useApp();
  const fav = isFavorite(product.id);
  const discountPct =
    product.hasDiscount && product.originalPrice
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0;

  return (
    <TouchableOpacity
      style={[styles.card, { width: CARD_WIDTH }]}
      onPress={onPress}
      activeOpacity={0.92}
    >
      <View style={styles.imageWrap}>
        <Image source={{ uri: product.image }} style={styles.image} resizeMode="cover" />
        {discountPct > 0 ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{discountPct}%</Text>
          </View>
        ) : null}
        <TouchableOpacity
          style={styles.favButton}
          onPress={() => toggleFavorite(product.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={fav ? 'heart' : 'heart-outline'}
            size={18}
            color={fav ? Colors.danger : Colors.textGray}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.priceRow}>
          {product.hasDiscount && product.originalPrice ? (
            <Text style={styles.oldPrice}>
              {product.originalPrice.toLocaleString()}
            </Text>
          ) : null}
          <Text style={styles.price}>{product.price.toLocaleString()} د.ع</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.addButton} onPress={() => addToCart(product)}>
        <Ionicons name="add" size={18} color={Colors.white} />
        <Text style={styles.addButtonText}>أضف</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadow.sm,
  },
  imageWrap: {
    position: 'relative',
    backgroundColor: Colors.surfaceMuted,
  },
  image: {
    width: '100%',
    height: 128,
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  discountText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  favButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  info: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    minHeight: 72,
  },
  name: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textDark,
    textAlign: 'right',
    lineHeight: 18,
    marginBottom: 6,
  },
  priceRow: {
    alignItems: 'flex-end',
  },
  oldPrice: {
    textDecorationLine: 'line-through',
    color: Colors.textLight,
    fontSize: 11,
  },
  price: {
    fontWeight: '800',
    color: Colors.primary,
    fontSize: FontSize.md,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    margin: Spacing.sm,
    marginTop: 0,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  addButtonText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: FontSize.sm,
  },
});
