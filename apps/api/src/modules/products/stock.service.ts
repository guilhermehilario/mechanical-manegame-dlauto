import { Injectable } from '@nestjs/common';
import { InsufficientStockError, NotFoundError } from '../../common/errors/domain.error';
import { ErrorCodes } from '@mechanic-system/types';
import type { CreateStockMovementInput } from '@mechanic-system/validation';
import type { StockMovementDto } from '@mechanic-system/types';
import type { Prisma, StockMovement, Product } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Transaction client type — shared with modules that compose transactions. */
export type TxClient = Prisma.TransactionClient;

function toDto(movement: StockMovement, productName: string): StockMovementDto {
  return {
    id: movement.id,
    productId: movement.productId,
    productName,
    type: movement.type,
    quantity: movement.quantity,
    reason: movement.reason,
    previousStock: movement.previousStock,
    newStock: movement.newStock,
    userId: movement.userId,
    createdAt: movement.createdAt.toISOString(),
  };
}

/**
 * Stock movements (spec 36): every stock change goes through here, inside a
 * single transaction that both records the movement and updates the product.
 * Direct `stockQuantity` edits are forbidden — this trail is the only way.
 */
@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Core movement logic, callable with an external transaction client so
   * multi-step operations (e.g. work order items) compose atomically.
   */
  async applyInTransaction(
    tx: TxClient,
    userId: string,
    input: CreateStockMovementInput,
  ): Promise<{ movement: StockMovement; product: Product }> {
    // SQLite serializes writes; read-modify-write inside one interactive
    // transaction is race-free for our single-node, embedded deployment.
    const product = await tx.product.findFirst({
      where: { id: input.productId, deletedAt: null },
    });
    if (!product) {
      throw new NotFoundError(ErrorCodes.PRODUCT_NOT_FOUND, 'Produto não encontrado');
    }

    let newStock: number;
    if (input.type === 'ADJUSTMENT') {
      newStock = input.quantity;
    } else {
      const delta = input.type === 'IN' ? input.quantity : -input.quantity;
      newStock = product.stockQuantity + delta;
    }

    if (newStock < 0) {
      throw new InsufficientStockError(
        `Estoque insuficiente para ${product.name} (disponível: ${product.stockQuantity})`,
      );
    }

    const movement = await tx.stockMovement.create({
      data: {
        productId: product.id,
        type: input.type,
        quantity: input.quantity,
        reason: input.reason,
        previousStock: product.stockQuantity,
        newStock,
        userId,
      },
    });

    await tx.product.update({
      where: { id: product.id },
      data: { stockQuantity: newStock },
    });

    return { movement, product };
  }

  async register(userId: string, input: CreateStockMovementInput): Promise<StockMovementDto> {
    const { movement, product } = await this.prisma.$transaction((tx) =>
      this.applyInTransaction(tx, userId, input),
    );
    return toDto(movement, product.name);
  }

  /**
   * Paginated movement trail, newest first (spec 25). Optionally filtered by
   * product — used by the product detail/history views.
   */
  async list(
    page: number,
    limit: number,
    productId?: string,
  ): Promise<{
    items: StockMovementDto[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const where = { ...(productId ? { productId } : {}) };
    const [movements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { name: true } } },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return {
      items: movements.map((movement) => toDto(movement, movement.product.name)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }
}
