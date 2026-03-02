import {
  inferGuideContentClass,
  inferGuideDestinationPath,
  inferGuideModuleFromSourceUrl,
  inferGuidePageType,
  inferGuideTemplateType,
  normalizeGuideCanonicalPath,
  slugifyGuideText
} from '../../../src/api/services/GuideService';

describe('Guide routing helpers', () => {
  it('normalizes incoming guide paths to /ielts namespace', () => {
    expect(normalizeGuideCanonicalPath('speaking/part-2')).toBe('/ielts/speaking/part-2');
    expect(normalizeGuideCanonicalPath('/ielts/writing/task-2/')).toBe('/ielts/writing/task-2');
    expect(normalizeGuideCanonicalPath('')).toBe('/ielts');
  });

  it('slugifies source text safely', () => {
    expect(slugifyGuideText('IELTS Task 2: Opinion Essay!')).toBe('ielts-task-2-opinion-essay');
  });

  it('infers module from source URL patterns', () => {
    expect(inferGuideModuleFromSourceUrl('https://example.com/ielts-speaking-topics')).toBe('speaking');
    expect(inferGuideModuleFromSourceUrl('https://example.com/ielts-writing-task-1')).toBe('writing');
    expect(inferGuideModuleFromSourceUrl('https://example.com/ielts-band-score-calculation')).toBe('band-scores');
  });

  it('maps module to class/type/template', () => {
    const module = inferGuideModuleFromSourceUrl('https://example.com/ielts-reading-true-false-not-given');
    const contentClass = inferGuideContentClass(module);
    const pageType = inferGuidePageType(module);
    const template = inferGuideTemplateType(pageType);

    expect(contentClass).toBe('class_a_core_learning');
    expect(pageType).toBe('lesson');
    expect(template).toBe('LessonTemplate');
  });

  it('infers destination path under hierarchical /ielts routes', () => {
    expect(inferGuideDestinationPath('https://ieltsliz.com/ielts-speaking-part-2-cue-card/')).toBe('/ielts/speaking/speaking-part-2-cue-card');
    expect(inferGuideDestinationPath('https://ieltsliz.com/ielts-writing-task-2/')).toBe('/ielts/writing/writing-task-2');
  });
});
