import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors, FontSize, Spacing, BorderRadius, Shadow, getBottomSafeInset } from '../lib/theme';
import { useApp } from '../context/AppProvider';

const { width } = Dimensions.get('window');

export default function ProductDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { productId } = route.params;
  const { products, addToCart } = useApp();

  const product = products.find((p) => p.id === productId);

  if (!product) {
    return (
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.errorText}>المنتج غير موجود</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>رجوع</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const images = [product.image, product.image1, product.image2].filter(Boolean) as string[];

  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={() => navigation.goBack()}
      />
      <View style={[styles.sheet, { marginBottom: getBottomSafeInset(insets.bottom) + Spacing.lg }]}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={22} color={Colors.textDark} />
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false}>
          {images.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScroll}>
              {images.map((img, i) => (
                <Image key={i} source={{ uri: img }} style={styles.heroImage} resizeMode="cover" />
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.body}>
            <Text style={styles.title}>{product.name}</Text>

            <View style={styles.priceBlock}>
              {product.hasDiscount && product.originalPrice ? (
                <Text style={styles.oldPrice}>
                  {product.originalPrice.toLocaleString()} د.ع
                </Text>
              ) : null}
              <Text style={styles.price}>{product.price.toLocaleString()} د.ع</Text>
            </View>

            {product.desc ? <Text style={styles.desc}>{product.desc}</Text> : null}
          </View>
        </ScrollView>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            addToCart(product);
            navigation.goBack();
          }}
        >
          <Ionicons name="bag-add-outline" size={22} color={Colors.white} />
          <Text style={styles.addBtnText}>أضف إلى السلة</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: width,
    maxHeight: '88%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    ...Shadow.lg,
  },
  closeBtn: {
    alignSelf: 'flex-start',
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  imagesScroll: {
    marginBottom: Spacing.lg,
  },
  heroImage: {
    width: width - Spacing.lg * 2,
    height: 200,
    borderRadius: BorderRadius.lg,
    marginRight: Spacing.sm,
    backgroundColor: Colors.surfaceMuted,
  },
  body: {
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textDark,
    textAlign: 'right',
    marginBottom: Spacing.sm,
  },
  priceBlock: {
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
  },
  oldPrice: {
    textDecorationLine: 'line-through',
    color: Colors.textLight,
    fontSize: FontSize.sm,
  },
  price: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: FontSize.xxl,
  },
  desc: {
    color: Colors.textGray,
    fontSize: FontSize.md,
    lineHeight: 24,
    textAlign: 'right',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  addBtnText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: FontSize.lg,
  },
  errorText: {
    textAlign: 'center',
    color: Colors.textDark,
    fontSize: FontSize.lg,
    marginBottom: Spacing.lg,
  },
  backText: {
    textAlign: 'center',
    color: Colors.primary,
    fontWeight: '800',
  },
});
