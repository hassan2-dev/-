import React from 'react';
import { StyleSheet, I18nManager, View, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppProvider, useApp } from './context/AppProvider';
import { Colors, FontSize, Layout } from './lib/theme';
import Toast from './components/Toast';
import RedAppleLogo from './components/RedAppleLogo';

import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import OffersScreen from './screens/OffersScreen';
import FavoritesScreen from './screens/FavoritesScreen';
import AccountScreen from './screens/AccountScreen';
import CategoryProductsScreen from './screens/CategoryProductsScreen';
import ProductDetailScreen from './screens/ProductDetailScreen';
import CartScreen from './screens/CartScreen';
import PrivacyPolicyScreen from './screens/PrivacyPolicyScreen';
import AboutAppScreen from './screens/AboutAppScreen';
import NotificationsScreen from './screens/NotificationsScreen';

if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({
  name,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
}) {
  if (focused) {
    return (
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark]}
        style={styles.tabIconActive}
      >
        <Ionicons name={name} size={20} color={Colors.white} />
      </LinearGradient>
    );
  }
  return (
    <View style={styles.tabIcon}>
      <Ionicons name={name} size={22} color={Colors.tabInactive} />
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'الرئيسية',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="OffersTab"
        component={OffersScreen}
        options={{
          tabBarLabel: 'الخصومات',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'pricetag' : 'pricetag-outline'} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="FavoritesTab"
        component={FavoritesScreen}
        options={{
          tabBarLabel: 'المفضلة',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'heart' : 'heart-outline'} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="AccountTab"
        component={AccountScreen}
        options={{
          tabBarLabel: 'حسابي',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'person' : 'person-outline'} focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { isLoggedIn, isCheckingAuth } = useApp();

  if (isCheckingAuth) {
    return (
      <LinearGradient
        colors={['#FFFEFE', '#FFF5F5', '#FFFFFF']}
        style={styles.splash}
      >
        <View style={[styles.splashBlob, styles.splashBlobTop]} />
        <RedAppleLogo size={96} />
        <Text style={styles.splashText}>متجر تفاحة</Text>
        <Text style={styles.splashSub}>تسوق طازج بكل سهولة</Text>
      </LinearGradient>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isLoggedIn ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="CategoryProducts" component={CategoryProductsScreen} />
          <Stack.Screen name="Cart" component={CartScreen} />
          <Stack.Screen
            name="ProductDetail"
            component={ProductDetailScreen}
            options={{ presentation: 'transparentModal', animation: 'fade' }}
          />
          <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
          <Stack.Screen name="AboutApp" component={AboutAppScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider style={styles.container}>
        <AppProvider>
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
          <Toast />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    position: 'absolute',
    height: Layout.tabBarHeight,
    paddingBottom: 10,
    paddingTop: 10,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    elevation: 12,
    shadowColor: '#1A2A1C',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  tabIcon: {
    width: 40,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: {
    width: 44,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  splashBlob: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(229, 57, 53, 0.08)',
  },
  splashBlobTop: {
    width: 260,
    height: 260,
    top: -70,
    right: -60,
  },
  splashText: {
    fontSize: FontSize.title,
    fontWeight: '800',
    color: Colors.textDark,
  },
  splashSub: {
    fontSize: FontSize.sm,
    color: Colors.textGray,
  },
});
