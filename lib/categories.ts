import { Category } from './types';

export function getParentCategories(categories: Category[]): Category[] {
  return categories.filter((c) => !c.parentId);
}

export function getSubCategories(categories: Category[], parentId: string): Category[] {
  return categories.filter((c) => c.parentId === parentId);
}

export function getCategoryById(categories: Category[], id: string): Category | undefined {
  return categories.find((c) => c.id === id);
}

export function getCategoryDisplayName(categories: Category[], category: Category): string {
  if (!category.parentId) return category.name;
  const parent = getCategoryById(categories, category.parentId);
  return parent ? `${parent.name} › ${category.name}` : category.name;
}
