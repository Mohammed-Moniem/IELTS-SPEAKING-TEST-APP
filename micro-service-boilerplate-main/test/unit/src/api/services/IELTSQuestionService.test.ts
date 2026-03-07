const mockHistoryQuery = {
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue([])
};

const buildQuestionQuery = () => ({
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn()
});

const part1Docs = [
  { _id: { toString: () => 'p1-1' }, question: 'Part 1 question 1', topic: 'Topic A' },
  { _id: { toString: () => 'p1-2' }, question: 'Part 1 question 2', topic: 'Topic B' },
  { _id: { toString: () => 'p1-3' }, question: 'Part 1 question 3', topic: 'Topic C' },
  { _id: { toString: () => 'p1-4' }, question: 'Part 1 question 4', topic: 'Topic D' }
];

const part2Docs = [
  {
    _id: { toString: () => 'p2-1' },
    question: 'Describe a memorable trip.',
    topic: 'Travel',
    cueCard: {
      mainTopic: 'Travel',
      bulletPoints: ['Where you went', 'Who you went with'],
      preparationTime: 60,
      timeToSpeak: 120
    }
  }
];

const part3Docs = [
  { _id: { toString: () => 'p3-1' }, question: 'Part 3 question 1', topic: 'Travel' },
  { _id: { toString: () => 'p3-2' }, question: 'Part 3 question 2', topic: 'Society' },
  { _id: { toString: () => 'p3-3' }, question: 'Part 3 question 3', topic: 'Culture' }
];

const mockUpdateManyExec = jest.fn().mockResolvedValue({ modifiedCount: 8 });
const mockUpdateMany = jest.fn(() => ({ exec: mockUpdateManyExec }));
const mockFind = jest.fn();
const mockAggregate = jest.fn(() => {
  throw new Error('aggregate path should not be used for full test selection');
});
const mockPgQuery = jest.fn().mockResolvedValue({ rowCount: 8 });

jest.mock('@models/IELTSQuestionModel', () => ({
  IELTSQuestionModel: {
    find: mockFind,
    aggregate: mockAggregate,
    updateMany: mockUpdateMany
  }
}));

jest.mock('@lib/db/pgClient', () => ({
  getPgPool: () => ({
    query: mockPgQuery
  })
}));

const mockHistoryFind = jest.fn(() => mockHistoryQuery);
const mockHistoryCreate = jest.fn();

jest.mock('@models/UserQuestionHistoryModel', () => ({
  UserQuestionHistoryModel: {
    find: mockHistoryFind,
    create: mockHistoryCreate
  }
}));

import { IELTSQuestionService } from '@services/IELTSQuestionService';

describe('IELTSQuestionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHistoryFind.mockReturnValue(mockHistoryQuery);
    mockHistoryQuery.select.mockReturnThis();
    mockHistoryQuery.lean.mockResolvedValue([]);
    mockUpdateManyExec.mockResolvedValue({ modifiedCount: 8 });
    mockUpdateMany.mockReturnValue({ exec: mockUpdateManyExec });
    mockAggregate.mockImplementation(() => {
      throw new Error('aggregate path should not be used for full test selection');
    });
    mockPgQuery.mockResolvedValue({ rowCount: 8 });

    const part1Query = buildQuestionQuery();
    part1Query.lean.mockResolvedValue(part1Docs);

    const part2Query = buildQuestionQuery();
    part2Query.lean.mockResolvedValue(part2Docs);

    const part3Query = buildQuestionQuery();
    part3Query.lean.mockResolvedValue(part3Docs);

    mockFind
      .mockReturnValueOnce(part1Query)
      .mockReturnValueOnce(part2Query)
      .mockReturnValueOnce(part3Query);
  });

  it('builds a full test from bank without using aggregate sampling', async () => {
    const service = new IELTSQuestionService();

    const result = await service.buildFullTestFromBank('user-1', 'intermediate', { urc: 'test-urc' });

    expect(result).not.toBeNull();
    expect(result?.part1).toHaveLength(4);
    expect(result?.part2?._id.toString()).toBe('p2-1');
    expect(result?.part3).toHaveLength(3);
    expect(mockFind).toHaveBeenCalledTimes(3);
    expect(mockHistoryFind).toHaveBeenCalledTimes(1);
    expect(mockAggregate).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockPgQuery).toHaveBeenCalledTimes(1);
  });
});
