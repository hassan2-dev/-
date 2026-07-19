export type PaginatedResult<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export function paginate<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  return {
    items,
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

export function parsePageLimit(
  pageRaw?: string | number,
  limitRaw?: string | number,
  allowed = [10, 25, 50, 100],
) {
  const page = Math.max(1, Number(pageRaw) || 1);
  let limit = Number(limitRaw) || 25;
  if (!allowed.includes(limit)) limit = 25;
  return { page, limit, skip: (page - 1) * limit };
}
