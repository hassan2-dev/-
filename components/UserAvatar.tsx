import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../lib/theme';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return (parts[0]?.[0] || '?').toUpperCase();
}

type UserAvatarProps = {
  photoUrl?: string | null;
  name?: string | null;
  size?: number;
};

export default function UserAvatar({ photoUrl, name, size = 72 }: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const label = name?.trim() || '?';
  const showPhoto = Boolean(photoUrl) && !imageFailed;
  const borderRadius = Math.round(size * 0.33);

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius,
        },
      ]}
    >
      {showPhoto ? (
        <Image
          source={{ uri: photoUrl! }}
          style={[styles.image, { width: size, height: size, borderRadius }]}
          onError={() => setImageFailed(true)}
        />
      ) : label !== '?' ? (
        <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{getInitials(label)}</Text>
      ) : (
        <Ionicons name="person" size={size * 0.5} color={Colors.white} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    resizeMode: 'cover',
  },
  initials: {
    fontWeight: '800',
    color: Colors.white,
  },
});
