import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '../lib/theme';
import { Product } from '../lib/types';
import { resolveProductImage } from '../lib/productImage';
import { useApp } from '../context/AppProvider';
import RemoteImage from './RemoteImage';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_CARD_W = (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md) / 2;

interface Props {
  product: Product;
  onPress: () => void;
  compact?: boolean;
}

export default function ProductCard({ product, onPress, compact = false }: Props) {
  const { addToCart, toggleFavorite, isFavorite } = useApp();
  const fav = isFavorite(product.id);
  const imageUri = resolveProductImage(product);
  const cardWidth = compact ? '100%' : GRID_CARD_W;
  const imageHeight = compact ? 118 : 136;

  const discountPct =
    product.hasDiscount && product.originalPrice
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0;

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.imageWrap}>
        <RemoteImage uri={imageUri} style={{ width: '100%', height: imageHeight }} fallbackLabel={product.name} />

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
            size={16}
            color={fav ? Colors.danger : Colors.textGray}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.addFab}
          onPress={() => addToCart(product)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="add" size={18} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.priceRow}>
          {product.hasDiscount && product.originalPrice ? (
            <Text style={styles.oldPrice}>{product.originalPrice.toLocaleString()}</Text>
          ) : null}
          <Text style={styles.price}>{product.price.toLocaleString()} د.ع</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadow.md,
  },
  imageWrap: {
    position: 'relative',
    backgroundColor: Colors.surfaceMuted,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    start: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
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
    end: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  addFab: {
    position: 'absolute',
    bottom: 8,
    end: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  info: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    minHeight: 68,
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
    gap: 2,
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
});
