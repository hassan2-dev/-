import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '../lib/theme';
import { Product } from '../lib/types';
import { usePagination } from '../lib/usePagination';
import ProductCard from './ProductCard';

interface Props {
  products: Product[];
  onProductPress: (productId: string) => void;
  pageSize?: number;
  emptyText?: string;
}

export default function PaginatedProductGrid({
  products,
  onProductPress,
  pageSize = 20,
  emptyText = 'لا توجد منتجات',
}: Props) {
  const { visibleItems, hasMore, loadMore, total, shown } = usePagination(products, pageSize);

  if (products.length === 0) {
    return <Text style={styles.emptyText}>{emptyText}</Text>;
  }

  return (
    <View>
      <View style={styles.metaRow}>
        <Text style={styles.countText}>عرض {shown} من {total}</Text>
      </View>
      <View style={styles.grid}>
        {visibleItems.map((prod) => (
          <ProductCard
            key={prod.id}
            product={prod}
            onPress={() => onProductPress(prod.id)}
          />
        ))}
      </View>
      {hasMore ? (
        <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore}>
          <Text style={styles.loadMoreText}>تحميل المزيد</Text>
          <Ionicons name="chevron-down" size={18} color={Colors.primary} />
        </TouchableOpacity>
      ) : total > pageSize ? (
        <Text style={styles.allLoadedText}>تم عرض جميع المنتجات</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  metaRow: {
    marginBottom: Spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  countText: {
    textAlign: 'right',
    color: Colors.textGray,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textGray,
    fontSize: FontSize.md,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  loadMoreText: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: FontSize.md,
  },
  allLoadedText: {
    textAlign: 'center',
    color: Colors.textLight,
    fontSize: FontSize.sm,
    marginBottom: Spacing.lg,
  },
});
