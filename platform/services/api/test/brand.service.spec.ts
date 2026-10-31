import { NotFoundException } from '@nestjs/common';
import { BrandService } from '../src/brand/brand.service';

describe('BrandService', () => {
  let service: BrandService;

  const createMockBrand = (overrides: any = {}) => ({
    id: 'brand_1',
    workspaceId: 'ws_1',
    name: 'Test Brand',
    primaryColor: '#3B82F6',
    secondaryColor: '#1E40AF',
    accentColor: '#F59E0B',
    logoUrl: 'https://example.com/logo.png',
    guidelineUrl: null,
    colorsJson: null,
    typographyJson: null,
    brandProfileJson: null,
    toneTags: ['professional', 'modern'],
    voiceGuidelines: null,
    guidelines: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const prismaMock = {
    brand: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    task: {
      count: jest.fn(),
    },
  };

  const workspaceServiceMock = {
    getWorkspaceWithContext: jest.fn(),
    getEffectiveActiveTaskLimit: jest.fn().mockReturnValue(1),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BrandService(
      prismaMock as any,
      workspaceServiceMock as any,
    );
  });

  describe('listBrands', () => {
    it('returns all brands for a workspace', async () => {
      const brands = [
        createMockBrand({ id: 'brand_1', name: 'Brand One' }),
        createMockBrand({ id: 'brand_2', name: 'Brand Two' }),
      ];
      prismaMock.brand.findMany.mockResolvedValue(brands);

      const result = await service.listBrands('ws_1');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Brand One');
      expect(prismaMock.brand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: 'ws_1' },
        }),
      );
    });

    it('returns empty array when no brands exist', async () => {
      prismaMock.brand.findMany.mockResolvedValue([]);

      const result = await service.listBrands('ws_1');

      expect(result).toEqual([]);
    });
  });

  describe('getBrand', () => {
    it('returns brand by id', async () => {
      const brand = createMockBrand();
      prismaMock.brand.findFirst.mockResolvedValue(brand);

      const result = await service.getBrand('ws_1', 'brand_1');

      expect(result.id).toBe('brand_1');
      expect(result.name).toBe('Test Brand');
    });

    it('throws NotFoundException when brand not found', async () => {
      prismaMock.brand.findFirst.mockResolvedValue(null);

      await expect(service.getBrand('ws_1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createBrand', () => {
    it('creates brand with all fields', async () => {
      const createDto = {
        name: 'New Brand',
        primaryColor: '#FF0000',
        secondaryColor: '#00FF00',
        accentColor: '#0000FF',
        toneTags: ['bold', 'playful'],
      };
      const createdBrand = createMockBrand({
        ...createDto,
        id: 'brand_new',
      });
      workspaceServiceMock.getWorkspaceWithContext.mockResolvedValue({
        id: 'ws_1',
        subscription: { status: 'ACTIVE' },
      });
      prismaMock.brand.create.mockResolvedValue(createdBrand);

      const result = await service.createBrand('ws_1', createDto);

      expect(result.name).toBe('New Brand');
      expect(result.primaryColor).toBe('#FF0000');
    });
  });

  describe('updateBrand', () => {
    it('updates brand fields', async () => {
      const existingBrand = createMockBrand();
      prismaMock.brand.findFirst.mockResolvedValue(existingBrand);
      prismaMock.brand.update.mockResolvedValue({
        ...existingBrand,
        name: 'Updated Brand Name',
        primaryColor: '#000000',
      });

      const result = await service.updateBrand('ws_1', 'brand_1', {
        name: 'Updated Brand Name',
        primaryColor: '#000000',
      });

      expect(result.name).toBe('Updated Brand Name');
      expect(result.primaryColor).toBe('#000000');
    });

    it('throws NotFoundException when brand not found', async () => {
      prismaMock.brand.findFirst.mockResolvedValue(null);

      await expect(
        service.updateBrand('ws_1', 'nonexistent', { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteBrand', () => {
    it('deletes brand successfully', async () => {
      const brand = createMockBrand();
      prismaMock.brand.findFirst.mockResolvedValue(brand);
      prismaMock.brand.delete.mockResolvedValue(brand);

      await service.deleteBrand('ws_1', 'brand_1');

      expect(prismaMock.brand.delete).toHaveBeenCalledWith({
        where: { id: 'brand_1' },
      });
    });

    it('throws NotFoundException when brand not found', async () => {
      prismaMock.brand.findFirst.mockResolvedValue(null);

      await expect(service.deleteBrand('ws_1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Brand with extended fields', () => {
    it('handles colorsJson field for extended palette', async () => {
      const extendedColors = {
        primary: '#3B82F6',
        secondary: '#1E40AF',
        accent: '#F59E0B',
        gradients: ['linear-gradient(90deg, #3B82F6, #1E40AF)'],
        neutrals: ['#FFFFFF', '#F3F4F6', '#1F2937', '#111827'],
      };
      const brand = createMockBrand({ colorsJson: extendedColors });
      prismaMock.brand.findFirst.mockResolvedValue(brand);

      const result = await service.getBrand('ws_1', 'brand_1');

      expect(result.colorsJson).toEqual(extendedColors);
    });

    it('handles toneTags array', async () => {
      const brand = createMockBrand({
        toneTags: ['professional', 'innovative', 'trustworthy'],
      });
      prismaMock.brand.findFirst.mockResolvedValue(brand);

      const result = await service.getBrand('ws_1', 'brand_1');

      expect(result.toneTags).toHaveLength(3);
      expect(result.toneTags).toContain('professional');
    });
  });
});

