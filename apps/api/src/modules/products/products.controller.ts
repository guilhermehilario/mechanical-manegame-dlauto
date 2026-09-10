import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createProductSchema,
  createStockMovementSchema,
  productIdSchema,
  productQuerySchema,
  stockMovementQuerySchema,
  updateProductSchema,
} from '@mechanic-system/validation';
import type {
  CreateProductInput,
  CreateStockMovementInput,
  ProductQuery,
  StockMovementQuery,
  UpdateProductInput,
} from '@mechanic-system/validation';
import type { Paginated, ProductDto, StockMovementDto } from '@mechanic-system/types';
import { ErrorCodes } from '@mechanic-system/types';
import { UnauthorizedError } from '../../common/errors/domain.error';
import { ProductsService } from './products.service';
import { StockService } from './stock.service';
import { JwtAuthGuard, AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { RequireRoles, RolesGuard } from '../auth/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly stockService: StockService,
  ) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(productQuerySchema, 'query')) query: ProductQuery,
  ): Promise<Paginated<ProductDto>> {
    return this.productsService.list(
      query.page,
      query.limit,
      query.search,
      query.supplierId,
      query.lowStock,
      query.includeInactive,
    );
  }

  /** Movements list must be declared before the :id route (Nest route order). */
  @Get('movements')
  listMovements(
    @Query(new ZodValidationPipe(stockMovementQuerySchema, 'query')) query: StockMovementQuery,
  ): Promise<Paginated<StockMovementDto>> {
    return this.stockService.list(query.page, query.limit, query.productId);
  }

  @Get(':id')
  getById(
    @Param('id', new ZodValidationPipe(productIdSchema, 'param')) id: string,
  ): Promise<ProductDto> {
    return this.productsService.getById(id);
  }

  @Post()
  @RequireRoles('ADMIN', 'MANAGER', 'ATTENDANT')
  create(
    @Body(new ZodValidationPipe(createProductSchema)) input: CreateProductInput,
  ): Promise<ProductDto> {
    return this.productsService.create(input);
  }

  /** Stock movement (spec 36): the only way to change stockQuantity. */
  @Post('movements')
  @RequireRoles('ADMIN', 'MANAGER', 'ATTENDANT')
  registerMovement(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(createStockMovementSchema)) input: CreateStockMovementInput,
  ): Promise<StockMovementDto> {
    const userId = request.user?.id;
    if (!userId) {
      throw new UnauthorizedError('Authentication required', ErrorCodes.UNAUTHORIZED);
    }
    return this.stockService.register(userId, input);
  }

  @Patch(':id')
  @RequireRoles('ADMIN', 'MANAGER', 'ATTENDANT')
  update(
    @Param('id', new ZodValidationPipe(productIdSchema, 'param')) id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) input: UpdateProductInput,
  ): Promise<ProductDto> {
    return this.productsService.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRoles('ADMIN', 'MANAGER')
  async softDelete(
    @Param('id', new ZodValidationPipe(productIdSchema, 'param')) id: string,
  ): Promise<void> {
    await this.productsService.softDelete(id);
  }
}
