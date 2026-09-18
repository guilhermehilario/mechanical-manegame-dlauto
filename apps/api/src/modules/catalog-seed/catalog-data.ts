/**
 * Curated example catalog for the optional first-week seed (Bloco F/F3).
 * Prices are integer cents (spec §18). CNPJs are real validated numbers.
 */

export interface SeedServiceItem {
  name: string;
  description: string;
  priceCents: number;
  estimatedMinutes: number;
}

export interface SeedProductItem {
  code: string;
  name: string;
  costPriceCents: number;
  salePriceCents: number;
  stockQuantity: number;
  minStock: number;
  location: string;
}

export interface SeedSupplierItem {
  name: string;
  cnpj: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

export const SEED_SERVICES: SeedServiceItem[] = [
  { name: 'Troca de óleo', description: 'Troca do óleo do motor.', priceCents: 8000, estimatedMinutes: 30 },
  { name: 'Troca de filtro de óleo', description: '', priceCents: 3500, estimatedMinutes: 20 },
  {
    name: 'Revisão completa',
    description: 'Checklist completo: fluidos, filtros, freios, suspensão e iluminação.',
    priceCents: 35000,
    estimatedMinutes: 120,
  },
  { name: 'Alinhamento e balanceamento', description: '', priceCents: 12000, estimatedMinutes: 60 },
  { name: 'Troca de pastilhas de freio', description: '', priceCents: 14000, estimatedMinutes: 60 },
  { name: 'Troca de correia dentada', description: '', priceCents: 25000, estimatedMinutes: 180 },
  { name: 'Troca de bateria', description: '', priceCents: 6000, estimatedMinutes: 30 },
  { name: 'Recarga de ar-condicionado', description: '', priceCents: 18000, estimatedMinutes: 60 },
  { name: 'Diagnóstico eletrônico (scanner)', description: '', priceCents: 15000, estimatedMinutes: 45 },
  { name: 'Troca de fluido de freio', description: '', priceCents: 9000, estimatedMinutes: 45 },
];

export const SEED_PRODUCTS: SeedProductItem[] = [
  { code: 'OLEO-5W30', name: 'Óleo de motor 5W30 (1 L)', costPriceCents: 2500, salePriceCents: 4000, stockQuantity: 12, minStock: 5, location: 'Estoque A' },
  { code: 'OLEO-15W40', name: 'Óleo de motor 15W40 (1 L)', costPriceCents: 2200, salePriceCents: 3600, stockQuantity: 12, minStock: 5, location: 'Estoque A' },
  { code: 'FILTRO-OLEO', name: 'Filtro de óleo', costPriceCents: 1500, salePriceCents: 2800, stockQuantity: 8, minStock: 4, location: 'Estoque B' },
  { code: 'FILTRO-AR', name: 'Filtro de ar', costPriceCents: 2200, salePriceCents: 3800, stockQuantity: 6, minStock: 3, location: 'Estoque B' },
  { code: 'PASTILHA-FREIO', name: 'Jogo de pastilhas de freio dianteiro', costPriceCents: 9000, salePriceCents: 15000, stockQuantity: 4, minStock: 2, location: 'Estoque B' },
  { code: 'CORREIA-DENTADA', name: 'Correia dentada', costPriceCents: 12000, salePriceCents: 18900, stockQuantity: 3, minStock: 2, location: 'Estoque B' },
  { code: 'BATERIA-60AH', name: 'Bateria 60 Ah', costPriceCents: 28000, salePriceCents: 42000, stockQuantity: 5, minStock: 3, location: 'Estoque C' },
  { code: 'VELA-IGNICAO', name: 'Vela de ignição (unidade)', costPriceCents: 1800, salePriceCents: 3000, stockQuantity: 24, minStock: 12, location: 'Estoque A' },
  { code: 'FLUIDO-FREIO', name: 'Fluido de freio DOT 4 (1 L)', costPriceCents: 1800, salePriceCents: 3200, stockQuantity: 6, minStock: 4, location: 'Estoque B' },
  { code: 'GAS-AR', name: 'Gás refrigerante R134a (450 g)', costPriceCents: 5500, salePriceCents: 9000, stockQuantity: 4, minStock: 2, location: 'Estoque C' },
];

export const SEED_SUPPLIERS: SeedSupplierItem[] = [
  {
    name: 'Auto Peças Silva',
    cnpj: '11222333000181',
    phone: '+55 (11) 3456-7890',
    email: 'contato@autopecassilva.com.br',
    address: 'Rua das Oficinas, 120 – São Paulo/SP',
    notes: 'Fornecedor geral de peças e acessórios.',
  },
  {
    name: 'Distribuidora Nacional de Óleos',
    cnpj: '44556677000186',
    phone: '+55 (11) 2222-3344',
    email: 'vendas@dnoleos.com.br',
    address: 'Av. Industrial, 500 – Campinas/SP',
    notes: 'Óleos e lubrificantes.',
  },
  {
    name: 'Freios & Autos',
    cnpj: '90817263000180',
    phone: '+55 (31) 99999-1010',
    email: 'contato@freioautos.com.br',
    address: 'Rua do Freio, 45 – Belo Horizonte/MG',
    notes: 'Freios, pastilhas e componentes de suspensão.',
  },
];