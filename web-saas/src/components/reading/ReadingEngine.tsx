'use client';

import { useMemo, useState } from 'react';

import { ObjectiveQuestion, ObjectiveTestPayload } from '@/lib/types';

type AnswerValue = string | string[] | Record<string, string>;

type ReadingEngineProps = {
  test: ObjectiveTestPayload;
  answers: Record<string, AnswerValue>;
  onChangeAnswers: (next: Record<string, AnswerValue>) => void;
  onSubmit: () => void | Promise<void>;
  submitting?: boolean;
  compact?: boolean;
};

type QuestionWithSection = ObjectiveQuestion & { sectionId: 'p1' | 'p2' | 'p3' };
type SectionShape = {
  sectionId: 'p1' | 'p2' | 'p3';
  title: string;
  passageText: string;
  suggestedMinutes: number;
  questions: QuestionWithSection[];
};

const isAnswered = (value: AnswerValue | undefined) => {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return false;
};

const normalizeToArray = (value: AnswerValue | undefined): string[] => {
  if (Array.isArray(value)) return value.map(item => String(item));
  if (typeof value === 'string') return value.split(/[;,]/).map(item => item.trim()).filter(Boolean);
  return [];
};

const toStringValue = (value: AnswerValue | undefined) => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([k, v]) => `${k}:${v}`)
      .join('\n');
  }
  return '';
};

const buildSections = (test: ObjectiveTestPayload): SectionShape[] => {
  if (test.sections && test.sections.length > 0) {
    return test.sections
      .slice(0, 3)
      .map(section => ({
        sectionId: section.sectionId,
        title: section.title,
        passageText: section.passageText,
        suggestedMinutes: section.suggestedMinutes || 20,
        questions: (section.questions || []).map(question => ({
          ...question,
          sectionId: question.sectionId || section.sectionId
        }))
      }))
      .filter(section => section.questions.length > 0);
  }

  const questions = (test.questions || []).map(question => ({ ...question, sectionId: (question.sectionId || 'p1') as 'p1' | 'p2' | 'p3' }));
  return [
    {
      sectionId: 'p1',
      title: test.passageTitle || 'Passage 1',
      passageText: test.passageText || '',
      suggestedMinutes: Math.max(1, Math.round((test.suggestedTimeMinutes || 60) / 3)),
      questions
    }
  ];
};

export default function ReadingEngine({
  test,
  answers,
  onChangeAnswers,
  onSubmit,
  submitting = false,
  compact = false
}: ReadingEngineProps) {
  const sections = useMemo(() => buildSections(test), [test]);
  const [activeSectionId, setActiveSectionId] = useState<'p1' | 'p2' | 'p3'>(sections[0]?.sectionId || 'p1');
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [reviewMode, setReviewMode] = useState(false);
  const [flaggedQuestionIds, setFlaggedQuestionIds] = useState<string[]>([]);

  const activeSection = sections.find(section => section.sectionId === activeSectionId) || sections[0];
  const activeQuestion = activeSection?.questions[activeQuestionIndex];
  const allQuestions = sections.flatMap(section => section.questions);

  const answeredCount = allQuestions.reduce((count, question) => (isAnswered(answers[question.questionId]) ? count + 1 : count), 0);
  const totalCount = allQuestions.length;

  const setAnswer = (questionId: string, value: AnswerValue) => {
    onChangeAnswers({
      ...answers,
      [questionId]: value
    });
  };

  const renderInput = (question: QuestionWithSection) => {
    const value = answers[question.questionId];
    const kind = question.answerSpec?.kind || (question.type === 'multiple_choice_multiple' ? 'multi' : 'single');
    const options = question.options || [];

    if (options.length > 0 && kind === 'single') {
      return (
        <div className="space-y-2">
          {options.map(option => {
            const selected = toStringValue(value) === option;
            return (
              <label
                key={option}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors ${
                  selected
                    ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                <input
                  type="radio"
                  className="accent-violet-600"
                  checked={selected}
                  onChange={() => setAnswer(question.questionId, option)}
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      );
    }

    if (options.length > 0 && kind === 'multi') {
      const selected = new Set(normalizeToArray(value));
      return (
        <div className="space-y-2">
          {options.map(option => (
            <label
              key={option}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors ${
                selected.has(option)
                  ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              <input
                type="checkbox"
                className="accent-violet-600"
                checked={selected.has(option)}
                onChange={event => {
                  const next = new Set(selected);
                  if (event.target.checked) next.add(option);
                  else next.delete(option);
                  setAnswer(question.questionId, Array.from(next));
                }}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      );
    }

    const placeholder =
      kind === 'map'
        ? 'Use key:value lines (e.g. A:ii)'
        : kind === 'ordered'
          ? 'Enter answers in order, separated by comma'
          : question.answerSpec?.maxWords
            ? `Max ${question.answerSpec.maxWords} words`
            : 'Type your answer';

    return (
      <textarea
        className="min-h-[92px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        value={toStringValue(value)}
        onChange={event => setAnswer(question.questionId, event.target.value)}
        placeholder={placeholder}
      />
    );
  };

  if (!activeSection || !activeQuestion) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        Reading content is unavailable for this attempt.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {sections.map((section, index) => {
          const sectionAnswered = section.questions.filter(question => isAnswered(answers[question.questionId])).length;
          const active = section.sectionId === activeSection.sectionId;
          return (
            <button
              key={section.sectionId}
              type="button"
              onClick={() => {
                setActiveSectionId(section.sectionId);
                setActiveQuestionIndex(0);
                setReviewMode(false);
              }}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                active
                  ? 'border-violet-500 bg-violet-600 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              Passage {index + 1} ({sectionAnswered}/{section.questions.length})
            </button>
          );
        })}
      </div>

      <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[1fr_380px]'}`}>
        <article className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">{activeSection.title}</h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-300">{activeSection.passageText || 'Passage content unavailable for this section.'}</p>
        </article>

        <aside className="space-y-4">
          <article className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Progress</h4>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {answeredCount}/{totalCount}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <span
                className="block h-full rounded-full bg-violet-500"
                style={{ width: `${totalCount > 0 ? (answeredCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </article>

          {reviewMode ? (
            <article className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <h4 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">Review Answers</h4>
              <ul className="space-y-1.5">
                {allQuestions.map((question, index) => (
                  <li key={question.questionId} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">
                      Q{index + 1} ({question.sectionId?.toUpperCase()})
                    </span>
                    <span className={isAnswered(answers[question.questionId]) ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                      {isAnswered(answers[question.questionId]) ? 'Answered' : 'Missing'}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  onClick={() => setReviewMode(false)}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  onClick={() => void onSubmit()}
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </article>
          ) : (
            <article className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  {activeSection.title} • Question {activeQuestionIndex + 1}
                </h4>
                <button
                  type="button"
                  className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                    flaggedQuestionIds.includes(activeQuestion.questionId)
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                  onClick={() =>
                    setFlaggedQuestionIds(prev =>
                      prev.includes(activeQuestion.questionId)
                        ? prev.filter(id => id !== activeQuestion.questionId)
                        : [...prev, activeQuestion.questionId]
                    )
                  }
                >
                  {flaggedQuestionIds.includes(activeQuestion.questionId) ? 'Flagged' : 'Flag'}
                </button>
              </div>
              <p className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">{activeQuestion.prompt}</p>
              {activeQuestion.instructions ? (
                <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">{activeQuestion.instructions}</p>
              ) : null}
              {renderInput(activeQuestion)}
            </article>
          )}

          <article className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Navigator</h4>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {activeSection.questions.length} questions
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeSection.questions.map((question, index) => (
                <button
                  key={question.questionId}
                  type="button"
                  onClick={() => {
                    setActiveQuestionIndex(index);
                    setReviewMode(false);
                  }}
                  className={`h-8 w-8 rounded-lg text-xs font-bold ${
                    index === activeQuestionIndex
                      ? 'bg-violet-600 text-white'
                      : isAnswered(answers[question.questionId])
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </article>
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        <button
          type="button"
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          onClick={() => setActiveQuestionIndex(prev => Math.max(0, prev - 1))}
          disabled={activeQuestionIndex === 0}
        >
          Previous
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            onClick={() => setReviewMode(true)}
          >
            Review
          </button>
          <button
            type="button"
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            onClick={() => void onSubmit()}
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Test'}
          </button>
        </div>
        <button
          type="button"
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          onClick={() => setActiveQuestionIndex(prev => Math.min(activeSection.questions.length - 1, prev + 1))}
          disabled={activeQuestionIndex >= activeSection.questions.length - 1}
        >
          Next
        </button>
      </div>
    </div>
  );
}
