import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class TravelPageDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page?: number;
}

export async function readPage<T>(
  query: TravelPageDto,
  count: () => Promise<number>,
  read: (skip: number, take: number) => Promise<T[]>,
) {
  const pageSize = 20;
  const total = await count();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(query.page ?? 1, totalPages);
  const items = await read((page - 1) * pageSize, pageSize);
  return { items, page, pageSize, total, totalPages };
}
