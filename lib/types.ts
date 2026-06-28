import type { ApartmentSelection } from './apartmentCode';

export type { ApartmentSelection };

export interface Category {
  id: string;
  name: string;
  image: string;
  parentId?: string;
}

export interface StoreSettings {
  openTime: string;
  closeTime: string;
  timezone: string;
  enabled: boolean;
}

export interface Product {
  id: string;
  name: string;
  desc?: string;
  image: string;
  image1?: string;
  image2?: string;
  price: number;
  originalPrice?: number;
  hasDiscount?: boolean;
  category: string;
}

export interface CartItem extends Product {
  qty: number;
}

export interface Banner {
  id: string;
  image: string;
}

export interface Offer {
  id: string;
  image: string;
}

export interface OrderItem {
  id: string;
  name: string;
  image: string;
  qty: number;
  price: number;
  originalPrice: number;
}

export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'on_the_way';

export interface OrderRecord {
  id: string;
  userId?: string;
  name: string;
  phone: string;
  address: string;
  items: OrderItem[];
  total: number;
  totalDiscount?: number;
  status: OrderStatus | string;
  createdAt?: string;
  statusUpdatedAt?: string;
  scheduledAt?: string;
  isScheduled?: boolean;
}

export interface UserProfile {
  name: string;
  phone: string;
  address: string;
  apartment?: ApartmentSelection;
}

export type RootStackParamList = {
  Login: undefined;
  MainTabs: undefined;
  CategoryProducts: { categoryName: string };
  SubCategories: { parentId: string; parentName: string };
  ProductDetail: { productId: string };
  Cart: undefined;
  DeliveryAddress: undefined;
};