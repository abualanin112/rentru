import { cursorPaginate } from '../../CursorPaginate.js';
import { ApiError } from '../../ApiError.js';
import { vi, describe, test, expect, beforeEach } from 'vitest';

describe('Universal Cursor Pagination Engine', () => {
  let mockModel;

  beforeEach(() => {
    mockModel = {
      findMany: vi.fn(),
    };
  });

  test('should return results, nextCursor, and hasNextPage when there is a next page', async () => {
    const mockData = [
      { id: 'uuid-1', createdAt: '2026-06-12T10:00:00Z', title: 'A' },
      { id: 'uuid-2', createdAt: '2026-06-12T09:00:00Z', title: 'B' },
      { id: 'uuid-3', createdAt: '2026-06-12T08:00:00Z', title: 'C' }, // extra record
    ];
    mockModel.findMany.mockResolvedValue(mockData);

    const result = await cursorPaginate(mockModel, {
      limit: 2,
      where: { active: true },
    });

    expect(mockModel.findMany).toHaveBeenCalledWith({
      take: 3,
      where: { active: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    expect(result.results.length).toBe(2);
    expect(result.hasNextPage).toBe(true);

    // Check if nextCursor encodes the last returned record correctly
    const expectedCursorObj = {
      createdAt: '2026-06-12T09:00:00Z',
      id: 'uuid-2',
    };
    const expectedCursorBase64 = Buffer.from(JSON.stringify(expectedCursorObj)).toString('base64');
    expect(result.nextCursor).toBe(expectedCursorBase64);
  });

  test('should parse incoming base64 cursor and apply tuple OR logic descending', async () => {
    mockModel.findMany.mockResolvedValue([]);

    const cursorObj = {
      createdAt: '2026-06-12T09:00:00Z',
      id: 'uuid-2',
    };
    const base64Cursor = Buffer.from(JSON.stringify(cursorObj)).toString('base64');

    await cursorPaginate(mockModel, {
      limit: 10,
      cursor: base64Cursor,
    });

    expect(mockModel.findMany).toHaveBeenCalledWith({
      take: 11,
      where: {
        AND: [
          {},
          {
            OR: [
              { createdAt: { lt: '2026-06-12T09:00:00Z' } },
              {
                createdAt: '2026-06-12T09:00:00Z',
                id: { lt: 'uuid-2' },
              },
            ],
          },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  });

  test('should parse incoming base64 cursor and apply tuple OR logic ascending', async () => {
    mockModel.findMany.mockResolvedValue([]);

    const cursorObj = {
      createdAt: '2026-06-12T09:00:00Z',
      id: 'uuid-2',
    };
    const base64Cursor = Buffer.from(JSON.stringify(cursorObj)).toString('base64');

    await cursorPaginate(mockModel, {
      limit: 10,
      cursor: base64Cursor,
      sortOrder: 'asc',
    });

    expect(mockModel.findMany).toHaveBeenCalledWith({
      take: 11,
      where: {
        AND: [
          {},
          {
            OR: [
              { createdAt: { gt: '2026-06-12T09:00:00Z' } },
              {
                createdAt: '2026-06-12T09:00:00Z',
                id: { gt: 'uuid-2' },
              },
            ],
          },
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  });

  test('should throw ApiError on invalid cursor', async () => {
    await expect(cursorPaginate(mockModel, { cursor: 'invalid-base64-string' })).rejects.toThrow(ApiError);
  });
});
