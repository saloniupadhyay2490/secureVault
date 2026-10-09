import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export interface BrandConfig {
  iconType: 'fa5' | 'mci' | 'ion';
  iconName: string;
  iconColor: string;
  bgColor: string;
  category: string;
}

export function getBrandConfig(rawTitle: string): BrandConfig {
  const title = (rawTitle || '').toLowerCase().trim();

  // Google / Gmail / YouTube
  if (title.includes('gmail')) {
    return {
      iconType: 'fa5',
      iconName: 'google',
      iconColor: '#EA4335',
      bgColor: 'rgba(234, 67, 53, 0.12)',
      category: 'Email',
    };
  }

  if (title.includes('google') || title.includes('youtube')) {
    return {
      iconType: 'fa5',
      iconName: 'google',
      iconColor: '#EA4335',
      bgColor: 'rgba(234, 67, 53, 0.12)',
      category: 'Social',
    };
  }

  // Instagram
  if (title.includes('insta')) {
    return {
      iconType: 'fa5',
      iconName: 'instagram',
      iconColor: '#E1306C',
      bgColor: 'rgba(225, 48, 108, 0.12)',
      category: 'Social',
    };
  }

  // Facebook
  if (title.includes('facebook') || title.includes('fb')) {
    return {
      iconType: 'fa5',
      iconName: 'facebook-f',
      iconColor: '#1877F2',
      bgColor: 'rgba(24, 119, 242, 0.12)',
      category: 'Social',
    };
  }

  // GitHub / Work
  if (title.includes('github') || title.includes('git') || title.includes('slack') || title.includes('jira')) {
    return {
      iconType: 'fa5',
      iconName: 'github',
      iconColor: '#24292E',
      bgColor: 'rgba(36, 41, 46, 0.12)',
      category: 'Work',
    };
  }

  // Banking / Financial / PayPal
  if (
    title.includes('bank') ||
    title.includes('sbi') ||
    title.includes('hdfc') ||
    title.includes('icici') ||
    title.includes('axis') ||
    title.includes('paypal') ||
    title.includes('pay') ||
    title.includes('wallet')
  ) {
    return {
      iconType: 'fa5',
      iconName: 'university',
      iconColor: '#10B981',
      bgColor: 'rgba(16, 185, 129, 0.12)',
      category: 'Banking',
    };
  }

  // Twitter / X
  if (title.includes('twitter') || title === 'x') {
    return {
      iconType: 'fa5',
      iconName: 'twitter',
      iconColor: '#1DA1F2',
      bgColor: 'rgba(29, 161, 242, 0.12)',
      category: 'Social',
    };
  }

  // Netflix
  if (title.includes('netflix')) {
    return {
      iconType: 'mci',
      iconName: 'netflix',
      iconColor: '#E50914',
      bgColor: 'rgba(229, 9, 20, 0.12)',
      category: 'Other',
    };
  }

  // Amazon / Shopping
  if (title.includes('amazon') || title.includes('flipkart') || title.includes('shop') || title.includes('ebay')) {
    return {
      iconType: 'fa5',
      iconName: 'amazon',
      iconColor: '#FF9900',
      bgColor: 'rgba(255, 153, 0, 0.12)',
      category: 'Shopping',
    };
  }

  // Apple / iCloud
  if (title.includes('apple') || title.includes('icloud')) {
    return {
      iconType: 'fa5',
      iconName: 'apple',
      iconColor: '#64748B',
      bgColor: 'rgba(100, 116, 139, 0.12)',
      category: 'Other',
    };
  }

  // Microsoft / Outlook / Hotmail -> Email / Work
  if (title.includes('outlook') || title.includes('hotmail') || title.includes('mail') || title.includes('proton') || title.includes('yahoo')) {
    return {
      iconType: 'fa5',
      iconName: 'envelope',
      iconColor: '#00A4EF',
      bgColor: 'rgba(0, 164, 239, 0.12)',
      category: 'Email',
    };
  }

  if (title.includes('microsoft') || title.includes('office')) {
    return {
      iconType: 'fa5',
      iconName: 'microsoft',
      iconColor: '#00A4EF',
      bgColor: 'rgba(0, 164, 239, 0.12)',
      category: 'Work',
    };
  }

  // Spotify
  if (title.includes('spotify')) {
    return {
      iconType: 'fa5',
      iconName: 'spotify',
      iconColor: '#1DB954',
      bgColor: 'rgba(29, 185, 84, 0.12)',
      category: 'Other',
    };
  }

  // Discord
  if (title.includes('discord')) {
    return {
      iconType: 'fa5',
      iconName: 'discord',
      iconColor: '#5865F2',
      bgColor: 'rgba(88, 101, 242, 0.12)',
      category: 'Social',
    };
  }

  // LinkedIn
  if (title.includes('linkedin')) {
    return {
      iconType: 'fa5',
      iconName: 'linkedin-in',
      iconColor: '#0A66C2',
      bgColor: 'rgba(10, 102, 194, 0.12)',
      category: 'Work',
    };
  }

  // WhatsApp
  if (title.includes('whatsapp')) {
    return {
      iconType: 'fa5',
      iconName: 'whatsapp',
      iconColor: '#25D366',
      bgColor: 'rgba(37, 211, 102, 0.12)',
      category: 'Social',
    };
  }

  // Default: Shield / Key
  return {
    iconType: 'fa5',
    iconName: 'shield-alt',
    iconColor: '#06B6D4',
    bgColor: 'rgba(6, 182, 212, 0.12)',
    category: 'Other',
  };
}

interface BrandIconProps {
  title: string;
  size?: number;
  containerSize?: number;
}

export function BrandIcon({ title, size = 20, containerSize = 44 }: BrandIconProps) {
  const brand = getBrandConfig(title);

  return (
    <View
      style={[
        styles.container,
        {
          width: containerSize,
          height: containerSize,
          borderRadius: containerSize / 2,
          backgroundColor: brand.bgColor,
        },
      ]}
    >
      {brand.iconType === 'fa5' && (
        <FontAwesome5 name={brand.iconName} size={size} color={brand.iconColor} />
      )}
      {brand.iconType === 'mci' && (
        <MaterialCommunityIcons name={brand.iconName as any} size={size} color={brand.iconColor} />
      )}
      {brand.iconType === 'ion' && (
        <Ionicons name={brand.iconName as any} size={size} color={brand.iconColor} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
