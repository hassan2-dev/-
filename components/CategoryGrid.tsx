import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import AppIcon from './AppIcon';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../lib/theme';
import { Category } from '../lib/types';
import RemoteImage from './RemoteImage';

const GAP = Spacing.sm;
const CARD_W = 84;
const ROW_GAP = Spacing.sm;

interface Props {
  categories: Category[];
  onPress: (category: Category) => void;
}

function splitTwoRows(items: Category[]): [Category[], Category[]] {
  if (items.length === 0) return [[], []];
  const firstRowCount = Math.ceil(items.length / 2);
  return [items.slice(0, firstRowCount), items.slice(firstRowCount)];
}

function CategoryCell({
  category,
  onPress,
}: {
  category: Category;
  onPress: (category: Category) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.cell}
      onPress={() => onPress(category)}
      activeOpacity={0.88}
    >
      <View style={styles.imageBox}>
        <RemoteImage uri={category.image} style={styles.image} fallbackLabel={category.name} />
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {category.name}
      </Text>
    </TouchableOpacity>
  );
}

export default function CategoryGrid({ categories, onPress }: Props) {
  const [row1, row2] = useMemo(() => splitTwoRows(categories), [categories]);
  const columnCount = Math.max(row1.length, row2.length);

  if (columnCount === 0) return null;

  const renderRow = (rowCats: Category[]) => (
    <View style={styles.row}>
      {rowCats.map((cat) => (
        <CategoryCell key={cat.id} category={cat} onPress={onPress} />
      ))}
      {rowCats.length < columnCount
        ? Array.from({ length: columnCount - rowCats.length }).map((_, i) => (
            <View key={`spacer-${i}`} style={styles.cellSpacer} />
          ))
        : null}
    </View>
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      decelerationRate="fast"
    >
      <View style={styles.grid}>
        {renderRow(row1)}
        {row2.length > 0 ? renderRow(row2) : null}
      </View>
    </ScrollView>
  );
}

export function CategoryGridPlaceholder() {
  return (
    <View style={styles.empty}>
      <AppIcon name="apps-outline" size={32} color={Colors.textLight} />
      <Text style={styles.emptyText}>لا توجد أقسام بعد</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingVertical: 2,
  },
  grid: {
    gap: ROW_GAP,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
  },
  cell: {
    width: CARD_W,
    alignItems: 'center',
  },
  cellSpacer: {
    width: CARD_W,
  },
  imageBox: {
    width: CARD_W - 8,
    height: CARD_W - 8,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 2,
    borderColor: Colors.surface,
    ...Shadow.sm,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  name: {
    marginTop: Spacing.xs,
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textDark,
    textAlign: 'center',
    lineHeight: 15,
    minHeight: 30,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyText: {
    color: Colors.textGray,
    fontSize: FontSize.sm,
  },
});
