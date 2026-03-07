'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { ApiError, webApi } from '@/lib/api/client';
import type { CollocationLibraryEntry, ResourceLibraryEntry, VocabularyLibraryEntry } from '@/lib/types';
import { EmptyState, ErrorState, PageHeader, SectionCard, SkeletonSet, StatusBadge } from '@/components/ui/v2';

type LibraryKind = 'collocations' | 'vocabulary' | 'books' | 'channels';
type LibraryItem = CollocationLibraryEntry | VocabularyLibraryEntry | ResourceLibraryEntry;

type LibraryQuery = {
  search?: string;
  topic?: string;
  module?: 'speaking' | 'writing' | 'reading' | 'listening';
  cefr?: 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  limit?: number;
  offset?: number;
};

const libraryNav: Array<{ href: string; label: string; kind: LibraryKind }> = [
  { href: '/app/library/collocations', label: 'Collocations', kind: 'collocations' },
  { href: '/app/library/vocabulary', label: 'Vocabulary', kind: 'vocabulary' }
];

const moduleOptions = [
  { value: '', label: 'All modules' },
  { value: 'speaking', label: 'Speaking' },
  { value: 'writing', label: 'Writing' },
  { value: 'reading', label: 'Reading' },
  { value: 'listening', label: 'Listening' }
] as const;

const cefrOptions = [
  { value: '', label: 'All CEFR' },
  { value: 'A2', label: 'A2' },
  { value: 'B1', label: 'B1' },
  { value: 'B2', label: 'B2' },
  { value: 'C1', label: 'C1' },
  { value: 'C2', label: 'C2' }
] as const;

const difficultyOptions = [
  { value: '', label: 'All difficulty' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' }
] as const;

const config: Record<
  LibraryKind,
  {
    title: string;
    subtitle: string;
    deckEntryType: 'collocation' | 'vocabulary' | 'resource';
    load: (query: LibraryQuery) => Promise<{ items: LibraryItem[]; total: number }>;
  }
> = {
  collocations: {
    title: 'Collocations Library',
    subtitle: 'Curated collocations with examples, alternatives, and module relevance.',
    deckEntryType: 'collocation',
    load: query => webApi.listCollocations(query as Parameters<typeof webApi.listCollocations>[0]) as Promise<{
      items: LibraryItem[];
      total: number;
    }>
  },
  vocabulary: {
    title: 'Vocabulary Library',
    subtitle: 'Topic-based IELTS vocabulary with definitions, synonyms, and usage examples.',
    deckEntryType: 'vocabulary',
    load: query => webApi.listVocabulary(query as Parameters<typeof webApi.listVocabulary>[0]) as Promise<{
      items: LibraryItem[];
      total: number;
    }>
  },
  books: {
    title: 'Books Library',
    subtitle: 'Recommended IELTS books, ranked by quality and relevance.',
    deckEntryType: 'resource',
    load: query => webApi.listBooks(query as Parameters<typeof webApi.listBooks>[0]) as Promise<{
      items: LibraryItem[];
      total: number;
    }>
  },
  channels: {
    title: 'Channels Library',
    subtitle: 'High-quality IELTS channels and resources, including sponsored partner slots.',
    deckEntryType: 'resource',
    load: query => webApi.listChannels(query as Parameters<typeof webApi.listChannels>[0]) as Promise<{
      items: LibraryItem[];
      total: number;
    }>
  }
};

const isCollocation = (item: LibraryItem): item is CollocationLibraryEntry => 'phrase' in item;
const isVocabulary = (item: LibraryItem): item is VocabularyLibraryEntry => 'lemma' in item;

const displayTitle = (item: LibraryItem) => {
  if (isCollocation(item)) return item.phrase;
  if (isVocabulary(item)) return item.lemma;
  return item.title;
};

const displaySubtitle = (item: LibraryItem) => {
  if (isCollocation(item)) return item.meaning;
  if (isVocabulary(item)) return item.definition;
  return item.description || item.provider || 'Resource recommendation';
};

const displayMeta = (item: LibraryItem) => {
  const bits: string[] = [];
  if ('module' in item && item.module) bits.push(String(item.module));
  if ('topic' in item && item.topic) bits.push(String(item.topic));
  if ('cefr' in item && item.cefr) bits.push(String(item.cefr));
  if ('difficulty' in item && item.difficulty) bits.push(String(item.difficulty));
  return bits.join(' • ');
};

export function LibraryExplorerPage({ kind }: { kind: LibraryKind }) {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('');
  const [module, setModule] = useState('');
  const [cefr, setCefr] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [deckName, setDeckName] = useState(`${config[kind].title.replace(' Library', '')} Practice Deck`);
  const [deckStatus, setDeckStatus] = useState('');
  const [creatingDeck, setCreatingDeck] = useState(false);
  const searchParamsKey = searchParams.toString();

  const loadLibrary = async (overrides?: Partial<LibraryQuery>) => {
    setLoading(true);
    setError('');
    setDeckStatus('');
    try {
      const payload = await config[kind].load({
        search: (overrides?.search ?? search) || undefined,
        topic: (overrides?.topic ?? topic) || undefined,
        module: (((overrides?.module as string | undefined) ?? module) || undefined) as LibraryQuery['module'],
        cefr: (((overrides?.cefr as string | undefined) ?? cefr) || undefined) as LibraryQuery['cefr'],
        difficulty:
          (((overrides?.difficulty as string | undefined) ?? difficulty) || undefined) as LibraryQuery['difficulty'],
        limit: overrides?.limit ?? 48,
        offset: overrides?.offset ?? 0
      });
      setItems(payload.items);
      setTotal(payload.total);
      setSelected([]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load library entries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const querySearch = searchParams.get('search') || '';
    const queryTopic = searchParams.get('topic') || '';
    const queryModule = searchParams.get('module') || '';
    const queryCefr = searchParams.get('cefr') || '';
    const queryDifficulty = searchParams.get('difficulty') || '';

    setSearch(querySearch);
    setTopic(queryTopic);
    setModule(queryModule);
    setCefr(queryCefr);
    setDifficulty(queryDifficulty);

    void loadLibrary({
      search: querySearch || undefined,
      topic: queryTopic || undefined,
      module: (queryModule || undefined) as LibraryQuery['module'],
      cefr: (queryCefr || undefined) as LibraryQuery['cefr'],
      difficulty: (queryDifficulty || undefined) as LibraryQuery['difficulty']
    });
    // Keep filter state in sync with link-driven query params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, searchParamsKey]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggleItem = (itemId: string) => {
    setSelected(prev => (prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]));
  };

  const selectTop = () => {
    setSelected(items.slice(0, Math.min(8, items.length)).map(item => item.id));
  };

  const clearSelection = () => setSelected([]);

  const saveDeck = async () => {
    if (!selected.length) {
      setDeckStatus('Select at least one item before creating a deck.');
      return;
    }
    if (!deckName.trim()) {
      setDeckStatus('Deck name is required.');
      return;
    }

    setCreatingDeck(true);
    setDeckStatus('');
    try {
      const payload = await webApi.createLibraryDeck({
        name: deckName.trim(),
        entryType: config[kind].deckEntryType,
        entryIds: selected
      });
      setDeckStatus(`Deck created with ${payload.addedEntries} entries.`);
      setSelected([]);
    } catch (err) {
      setDeckStatus(err instanceof ApiError ? err.message : 'Failed to create deck');
    } finally {
      setCreatingDeck(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={config[kind].title}
        subtitle={config[kind].subtitle}
        actions={<StatusBadge tone="brand">Learner Library</StatusBadge>}
      />

      <SectionCard>
        <div className="flex flex-wrap items-center gap-2">
          {libraryNav.map(item => {
            const active = item.kind === kind;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${active
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Filters" subtitle={loading ? 'Loading...' : `Showing ${items.length} of ${total} entries`}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <input
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search phrase, lemma, title..."
          />
          <input
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            value={topic}
            onChange={event => setTopic(event.target.value)}
            placeholder="Topic (e.g., environment)"
          />
          <select
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            value={module}
            onChange={event => setModule(event.target.value)}
          >
            {moduleOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            value={cefr}
            onChange={event => setCefr(event.target.value)}
          >
            {cefrOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            value={difficulty}
            onChange={event => setDifficulty(event.target.value)}
          >
            {difficultyOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadLibrary()}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 shadow-lg shadow-violet-500/25 transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Practice Deck Builder">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="min-w-[220px] flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            value={deckName}
            onChange={event => setDeckName(event.target.value)}
            placeholder="Practice deck name"
          />
          <button
            type="button"
            onClick={selectTop}
            className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Select Top
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => void saveDeck()}
            disabled={creatingDeck}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 shadow-lg shadow-violet-500/25 transition-colors disabled:opacity-60"
          >
            {creatingDeck ? 'Saving...' : `Save to Practice Deck (${selected.length})`}
          </button>
        </div>
        {deckStatus ? <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{deckStatus}</p> : null}
      </SectionCard>

      {loading ? <SkeletonSet rows={6} /> : null}
      {!loading && error ? <ErrorState body={error} onRetry={() => void loadLibrary()} /> : null}

      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="No entries found"
          body="Try removing one or more filters, then run search again."
          action={
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setTopic('');
                setModule('');
                setCefr('');
                setDifficulty('');
                void loadLibrary();
              }}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Reset Filters
            </button>
          }
        />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map(item => (
            <article
              key={item.id}
              className={`group rounded-2xl border bg-white dark:bg-gray-900 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${selectedSet.has(item.id)
                  ? 'border-violet-300 dark:border-violet-500/40 shadow-md shadow-violet-500/10'
                  : 'border-gray-200 dark:border-gray-800'
                }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">{displayTitle(item)}</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{displaySubtitle(item)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{displayMeta(item)}</p>
                </div>
                <input
                  aria-label={`Select ${displayTitle(item)}`}
                  type="checkbox"
                  checked={selectedSet.has(item.id)}
                  onChange={() => toggleItem(item.id)}
                  className="mt-1 h-4 w-4 accent-violet-600"
                />
              </div>
              {'url' in item && item.url ? (
                <div className="mt-3 flex items-center gap-2">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                  >
                    Open resource →
                  </a>
                  {item.sponsored ? (
                    <StatusBadge tone="warning">Sponsored</StatusBadge>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
