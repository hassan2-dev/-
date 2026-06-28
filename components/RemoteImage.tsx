import React, { useEffect, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ImageStyle,
  ViewStyle,
  Text,
} from 'react-native';
import { Colors, FontSize } from '../lib/theme';

interface Props {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  fallbackLabel?: string;
}

export default function RemoteImage({
  uri,
  style,
  containerStyle,
  resizeMode = 'cover',
  fallbackLabel,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const normalizedUri = uri?.trim() || '';

  useEffect(() => {
    setLoaded(false);
    setFailed(!normalizedUri);
  }, [normalizedUri]);

  const flatStyle = StyleSheet.flatten(style) || {};
  const width = flatStyle.width ?? '100%';
  const height = flatStyle.height ?? 128;
  const initial = (fallbackLabel || '?').trim().charAt(0).toUpperCase();

  if (!normalizedUri || failed) {
    return (
      <View style={[styles.placeholder, { width, height }, containerStyle]}>
        <Text style={styles.initial}>{initial}</Text>
      </View>
    );
  }

  return (
    <View style={[{ width, height, overflow: 'hidden' }, containerStyle]}>
      {!loaded ? (
        <View style={[StyleSheet.absoluteFill, styles.loadingWrap]}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      ) : null}
      <Image
        source={{ uri: normalizedUri }}
        style={[styles.image, { width, height }, style]}
        resizeMode={resizeMode}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(true);
          setFailed(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: Colors.surfaceMuted,
  },
  placeholder: {
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.primary,
  },
  loadingWrap: {
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
