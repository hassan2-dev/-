import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppProvider, useApp } from './context/AppProvider';
import { Colors, FontSize, Layout, getBottomSafeInset } from './lib/theme';
import { TabIcons } from './components/AppIcon';
import TabCartButton from './components/TabCartButton';
import Toast from './components/Toast';
import OfflineOverlay from './components/OfflineOverlay';
import NotificationPermissionBanner from './components/NotificationPermissionBanner';
import ForceUpdateGate from './components/ForceUpdateGate';
import RedAppleLogo from './components/RedAppleLogo';

import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import CatalogScreen from './screens/CatalogScreen';
import CartTabScreen from './screens/CartTabScreen';
import OffersScreen from './screens/OffersScreen';
import FavoritesScreen from './screens/FavoritesScreen';
import AccountScreen from './screens/AccountScreen';
import CategoryProductsScreen from './screens/CategoryProductsScreen';
import SubCategoriesScreen from './screens/SubCategoriesScreen';
import ProductDetailScreen from './screens/ProductDetailScreen';
import CartScreen from './screens/CartScreen';
import StoreClosedOverlay from './components/StoreClosedOverlay';
import PrivacyPolicyScreen from './screens/PrivacyPolicyScreen';
import AboutAppScreen from './screens/AboutAppScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import DeliveryAddressScreen from './screens/DeliveryAddressScreen';
import OrderThankYouScreen from './screens/OrderThankYouScreen';
import MyOrdersScreen from './screens/MyOrdersScreen';


const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabsInner() {
  const insets = useSafeAreaInsets();
  const bottomInset = getBottomSafeInset(insets.bottom);

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.tabInactive,
          tabBarLabelStyle: styles.tabLabel,
          tabBarStyle: {
            ...styles.tabBar,
            height: Layout.tabBarHeight + bottomInset,
            paddingBottom: bottomInset,
          },
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeScreen}
          options={{
            tabBarLabel: 'الرئيسية',
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? TabIcons.home.active : TabIcons.home.inactive}
                size={size ?? 22}
                color={color}
              />
            ),
          }}
        />
        <Tab.Screen
          name="CatalogTab"
          component={CatalogScreen}
          options={{
            tabBarLabel: 'تسوق',
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? TabIcons.shop.active : TabIcons.shop.inactive}
                size={size ?? 22}
                color={color}
              />
            ),
          }}
        />
        <Tab.Screen
          name="CartTab"
          component={CartTabScreen}
          options={{
            tabBarLabel: () => null,
            tabBarButton: (props) => <TabCartButton {...props} />,
          }}
        />
        <Tab.Screen
          name="OffersTab"
          component={OffersScreen}
          options={{
            tabBarLabel: 'العروض',
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? TabIcons.offers.active : TabIcons.offers.inactive}
                size={size ?? 22}
                color={color}
              />
            ),
          }}
        />
        <Tab.Screen
          name="AccountTab"
          component={AccountScreen}
          options={{
            tabBarLabel: 'حسابي',
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? TabIcons.account.active : TabIcons.account.inactive}
                size={size ?? 22}
                color={color}
              />
            ),
          }}
        />
      </Tab.Navigator>
      <StoreClosedOverlay />
    </>
  );
}

function MainTabs() {
  return <MainTabsInner />;
}

function AppNavigator() {
  const { isLoggedIn, isCheckingAuth } = useApp();

  if (isCheckingAuth) {
    return (
      <View style={styles.splash}>
        <View style={[styles.splashBlob, styles.splashBlobTop]} />
        <RedAppleLogo size={96} />
        <Text style={styles.splashText}>متجر تفاحة</Text>
        <Text style={styles.splashSub}>تسوق طازج بكل سهولة</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isLoggedIn ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="SubCategories" component={SubCategoriesScreen} />
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
          <Stack.Screen name="Favorites" component={FavoritesScreen} />
          <Stack.Screen name="DeliveryAddress" component={DeliveryAddressScreen} />
          <Stack.Screen name="MyOrders" component={MyOrdersScreen} />
          <Stack.Screen
            name="OrderThankYou"
            component={OrderThankYouScreen}
            options={{ gestureEnabled: false }}
          />
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
          <ForceUpdateGate />
          <NotificationPermissionBanner />
          <OfflineOverlay />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 6,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: -2,
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    overflow: 'hidden',
    backgroundColor: Colors.background,
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
