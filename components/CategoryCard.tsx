import React from 'react';
import {
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  View,
} from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../lib/theme';
import { Category } from '../lib/types';

interface Props {
  category: Category;
  onPress: () => void;
}

export default function CategoryCard({ category, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: category.image }} style={styles.image} resizeMode="cover" />
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {category.name}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 88,
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  imageWrap: {
    width: 76,
    height: 76,
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
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textDark,
    marginTop: Spacing.sm,
    textAlign: 'center',
    lineHeight: 16,
  },
});
