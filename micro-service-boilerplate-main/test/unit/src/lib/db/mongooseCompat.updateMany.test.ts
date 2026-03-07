jest.mock('../../../../../src/lib/db/documentStore', () => ({
  queryTableRows: jest.fn(),
  loadTableRows: jest.fn(),
  upsertRow: jest.fn(),
  countTableRows: jest.fn(),
  deleteRowsByIds: jest.fn()
}));

import mongooseCompat from '../../../../../src/lib/db/mongooseCompat';
import { loadTableRows, queryTableRows, upsertRow } from '../../../../../src/lib/db/documentStore';

describe('mongooseCompat updateMany', () => {
  it('updates pushed-down matches without loading the full table', async () => {
    const nowIso = '2026-03-07T00:00:00.000Z';
    const queryTableRowsMock = queryTableRows as jest.MockedFunction<typeof queryTableRows>;
    const loadTableRowsMock = loadTableRows as jest.MockedFunction<typeof loadTableRows>;
    const upsertRowMock = upsertRow as jest.MockedFunction<typeof upsertRow>;

    loadTableRowsMock.mockImplementation(async () => {
      throw new Error('loadTableRows should not be used for pushed-down updateMany filters');
    });
    queryTableRowsMock.mockResolvedValue([
      {
        id: 'q1',
        data: { category: 'part1', active: true, timesUsed: 0 },
        createdAt: nowIso,
        updatedAt: nowIso
      },
      {
        id: 'q2',
        data: { category: 'part1', active: true, timesUsed: 2 },
        createdAt: nowIso,
        updatedAt: nowIso
      }
    ]);
    upsertRowMock.mockResolvedValue();

    const schema = new (mongooseCompat as any).Schema({}, { timestamps: true });
    const QuestionModel = (mongooseCompat as any).model(`PerfQuestion${Date.now()}`, schema);

    const result = await QuestionModel.updateMany(
      { _id: { $in: ['q1', 'q2'] } },
      {
        $inc: { timesUsed: 1 },
        $set: { lastUsedAt: nowIso }
      }
    ).exec();

    expect(queryTableRowsMock).toHaveBeenCalledWith(
      QuestionModel.tableName,
      expect.objectContaining({
        filter: { _id: { $in: ['q1', 'q2'] } },
        single: false
      })
    );
    expect(loadTableRowsMock).not.toHaveBeenCalled();
    expect(upsertRowMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      matchedCount: 2,
      modifiedCount: 2,
      upsertedCount: 0
    });
  });
});
