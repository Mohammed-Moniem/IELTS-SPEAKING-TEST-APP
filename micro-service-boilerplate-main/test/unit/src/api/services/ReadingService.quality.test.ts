import { ReadingService } from '../../../../../src/api/services/ReadingService';

describe('ReadingService quality guards', () => {
  const createService = () => new ReadingService({} as any, {} as any);

  it('flags low-fidelity seeded sections as low quality', () => {
    const service = createService() as any;

    const sections = [
      {
        sectionId: 'p1',
        title: 'Passage 1',
        passageText:
          'urban migration dynamics has become a central issue in recent IELTS-aligned source materials.\n\nThis passage (P1) focuses on core comprehension and asks candidates to identify main claims, supporting evidence, and implied assumptions.\n\nReaders should distinguish between explicit statements and inferred meaning.',
        suggestedMinutes: 20,
        questions: [
          {
            questionId: 'p1_q1',
            sectionId: 'p1',
            type: 'matching_headings',
            prompt: 'Based on the passage, answer the matching headings item about urban migration dynamics.',
            options: ['i', 'ii', 'iii', 'iv'],
            answerSpec: { kind: 'single', value: 'iii' }
          }
        ]
      },
      {
        sectionId: 'p2',
        title: 'Passage 2',
        passageText: 'Short placeholder section.',
        suggestedMinutes: 20,
        questions: [
          {
            questionId: 'p2_q1',
            sectionId: 'p2',
            type: 'multiple_choice_single',
            prompt: 'Based on the passage, answer the multiple choice single item.',
            options: ['A', 'B', 'C', 'D'],
            answerSpec: { kind: 'single', value: 'A' }
          }
        ]
      },
      {
        sectionId: 'p3',
        title: 'Passage 3',
        passageText:
          'Paragraph A\nManufacturing networks seeking circular performance initially focused on recycling rates.\n\nParagraph B\nA revised framework weighted three outcomes: material recovery, component reuse, and service-life extension.',
        suggestedMinutes: 20,
        questions: [
          {
            questionId: 'p3_q1',
            sectionId: 'p3',
            type: 'true_false_not_given',
            prompt: 'Based on the passage, answer true false not given.',
            options: ['True', 'False', 'Not Given'],
            answerSpec: { kind: 'single', value: 'False' }
          }
        ]
      }
    ];

    expect(service.isLowFidelitySections(sections)).toBe(true);
  });

  it('builds rich payload with 3 long sections and no paragraph labels', () => {
    const service = createService() as any;
    const payload = service.buildRichReadingPayload('academic');

    expect(payload.sectionCount).toBe(3);
    expect(payload.sections).toHaveLength(3);

    for (const section of payload.sections) {
      const text = section.passageText as string;
      const words = text.split(/\s+/).filter(Boolean).length;
      expect(words).toBeGreaterThanOrEqual(560);
      expect(text).not.toMatch(/^Paragraph [A-F]\b/m);
      expect(section.questions.length).toBeGreaterThanOrEqual(13);
    }
  });

  it('introduces variation across generated rich payload titles', () => {
    const service = createService() as any;
    const titles = new Set<string>();

    for (let i = 0; i < 5; i += 1) {
      const payload = service.buildRichReadingPayload('academic');
      titles.add(payload.title);
    }

    expect(titles.size).toBeGreaterThan(1);
  });
});
