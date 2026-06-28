import React from 'react';
import { ScrollView, StyleSheet, View, Text, Dimensions } from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '../lib/theme';
import { Product } from '../lib/types';
import ProductCard from './ProductCard';

const CARD_W = Dimensions.get('window').width * 0.42;

interface Props {
  products: Product[];
  onProductPress: (productId: string) => void;
}

export default function FeaturedProductsRow({ products, onProductPress }: Props) {
  if (products.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>لا توجد عروض حالياً</Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      decelerationRate="fast"
    >
      {products.map((product) => (
        <View key={product.id} style={{ width: CARD_W }}>
          <ProductCard
            product={product}
            onPress={() => onProductPress(product.id)}
            compact
          />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingStart: Spacing.lg,
    paddingEnd: Spacing.sm,
    gap: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  empty: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textGray,
    fontSize: FontSize.sm,
  },
});
