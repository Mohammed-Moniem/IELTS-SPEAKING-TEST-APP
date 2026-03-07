import { env } from '@env';
import { Logger } from '@lib/logger';
import { Aggregator, Query } from 'mingo';
import { ObjectId as MongoObjectId } from 'mongodb';
import { countTableRows, deleteRowsByIds, loadTableRows, queryTableRows, upsertRow } from './documentStore';
import { generateMongoStyleId, isMongoStyleId, normalizeMongoStyleId } from './id';
import { checkPgConnection } from './pgClient';
import { MODEL_TABLE_MAP } from './tableMappings';

const log = new Logger(__filename);
const warnedModes = new Set<string>();

const INTERNAL_MODEL = Symbol('compatModel');
const INTERNAL_STATE = Symbol('compatState');

type PlainObject = Record<string, any>;

type PreSaveHook<T> = (this: T, next: (error?: Error) => void) => void | Promise<void>;

interface SchemaMetadata {
  defaults: PlainObject;
  hiddenFields: Set<string>;
  refs: Map<string, string>;
  mapFields: Set<string>;
  timestamps: {
    createdAt?: string;
    updatedAt?: string;
  };
}

interface CompatState {
  isNew: boolean;
  original: PlainObject;
}

interface ProjectionSpec {
  include: Set<string>;
  exclude: Set<string>;
  forceInclude: Set<string>;
}

interface PopulateSpec {
  path: string;
  select?: string;
}

interface SortSpec {
  [path: string]: 1 | -1;
}

interface FindOptions {
  single: boolean;
  filter: PlainObject;
  projection?: string | PlainObject;
  sort?: SortSpec;
  skip?: number;
  limit?: number;
  populate?: PopulateSpec[];
  lean?: boolean;
}

interface QueryRowsOptions {
  filter: PlainObject;
  sort?: SortSpec;
  skip?: number;
  limit?: number;
  single?: boolean;
}

const isObject = (value: unknown): value is PlainObject => {
  return !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && !(value instanceof MongoObjectId);
};

const cloneDeep = <T>(value: T): T => {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return new Date(value.getTime()) as unknown as T;
  if (value instanceof MongoObjectId) return new MongoObjectId(value.toHexString()) as unknown as T;
  if (value instanceof Map) {
    const result = new Map();
    value.forEach((entryValue, key) => {
      result.set(key, cloneDeep(entryValue));
    });
    return result as unknown as T;
  }
  if (Array.isArray(value)) return value.map(item => cloneDeep(item)) as unknown as T;
  if (isObject(value)) {
    const result: PlainObject = {};
    Object.keys(value).forEach(key => {
      const nested = (value as PlainObject)[key];
      if (nested !== undefined) {
        result[key] = cloneDeep(nested);
      }
    });
    return result as T;
  }
  return value;
};

const toPlainSerializable = (value: any): any => {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof MongoObjectId) {
    return value.toHexString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Map) {
    const result: PlainObject = {};
    value.forEach((mapValue, mapKey) => {
      result[mapKey] = toPlainSerializable(mapValue);
    });
    return result;
  }

  if (Array.isArray(value)) {
    return value.map(item => toPlainSerializable(item));
  }

  if (isObject(value)) {
    const result: PlainObject = {};
    Object.keys(value).forEach(key => {
      if (key.startsWith('__')) {
        return;
      }

      const nested = value[key];
      if (typeof nested === 'function' || nested === undefined) {
        return;
      }

      result[key] = toPlainSerializable(nested);
    });

    return result;
  }

  return value;
};

const isLikelyIsoDate = (value: string): boolean => {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
};

const shouldHydrateObjectId = (path: string): boolean => {
  const last = path.split('.').pop() || path;
  if (last === '_id') return true;
  if (/(?:Id|Ids)$/.test(last)) return true;

  return [
    'participants',
    'readBy',
    'deliveredTo',
    'adminIds',
    'memberIds',
    'user',
    'sender',
    'recipient'
  ].includes(last);
};

const hydrateValue = (value: any, path: string, mapFields: Set<string>): any => {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => hydrateValue(item, path, mapFields));
  }

  if (typeof value === 'string') {
    if (isMongoStyleId(value) && shouldHydrateObjectId(path)) {
      return new MongoObjectId(value);
    }

    if (isLikelyIsoDate(value)) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return value;
  }

  if (isObject(value)) {
    if (mapFields.has(path)) {
      const mapResult = new Map<string, any>();
      Object.entries(value).forEach(([mapKey, mapValue]) => {
        mapResult.set(mapKey, hydrateValue(mapValue, `${path}.${mapKey}`, mapFields));
      });
      return mapResult;
    }

    const result: PlainObject = {};
    Object.entries(value).forEach(([nestedKey, nestedValue]) => {
      const nestedPath = path ? `${path}.${nestedKey}` : nestedKey;
      result[nestedKey] = hydrateValue(nestedValue, nestedPath, mapFields);
    });

    return result;
  }

  return value;
};

const normalizeQueryValue = (value: any): any => {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof MongoObjectId) {
    return value.toHexString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(entry => normalizeQueryValue(entry));
  }

  if (value instanceof Map) {
    const result: PlainObject = {};
    value.forEach((mapValue, mapKey) => {
      result[mapKey] = normalizeQueryValue(mapValue);
    });
    return result;
  }

  if (isObject(value)) {
    const result: PlainObject = {};
    Object.entries(value).forEach(([key, nested]) => {
      result[key] = normalizeQueryValue(nested);
    });
    return result;
  }

  return value;
};

const getPath = (value: PlainObject, path: string): any => {
  if (!path) return value;

  const parts = path.split('.');
  let current: any = value;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (current instanceof Map) {
      current = current.get(part);
    } else {
      current = current[part];
    }
  }

  return current;
};

const setPath = (value: PlainObject, path: string, next: any): void => {
  const parts = path.split('.');
  let current: any = value;

  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];

    if (!isObject(current[part])) {
      current[part] = {};
    }

    current = current[part];
  }

  current[parts[parts.length - 1]] = next;
};

const unsetPath = (value: PlainObject, path: string): void => {
  const parts = path.split('.');
  let current: any = value;

  for (let i = 0; i < parts.length - 1; i += 1) {
    current = current?.[parts[i]];
    if (current === undefined || current === null) {
      return;
    }
  }

  if (current && typeof current === 'object') {
    delete current[parts[parts.length - 1]];
  }
};

const mergeDeep = (target: PlainObject, source: PlainObject): PlainObject => {
  const output: PlainObject = cloneDeep(target);

  Object.entries(source).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      output[key] = cloneDeep(value);
      return;
    }

    if (isObject(value)) {
      const nextTarget = isObject(output[key]) ? (output[key] as PlainObject) : {};
      output[key] = mergeDeep(nextTarget, value);
      return;
    }

    output[key] = value;
  });

  return output;
};

const parseProjection = (projection?: string | PlainObject): ProjectionSpec => {
  const include = new Set<string>();
  const exclude = new Set<string>();
  const forceInclude = new Set<string>();

  if (!projection) {
    return { include, exclude, forceInclude };
  }

  if (typeof projection === 'string') {
    projection
      .split(' ')
      .map(token => token.trim())
      .filter(Boolean)
      .forEach(token => {
        if (token.startsWith('+')) {
          forceInclude.add(token.slice(1));
        } else if (token.startsWith('-')) {
          exclude.add(token.slice(1));
        } else {
          include.add(token);
        }
      });

    return { include, exclude, forceInclude };
  }

  Object.entries(projection).forEach(([key, value]) => {
    if (value === 0 || value === false) {
      exclude.add(key);
      return;
    }

    include.add(key);
  });

  return { include, exclude, forceInclude };
};

const applyProjection = (
  source: PlainObject,
  projection: ProjectionSpec,
  hiddenFields: Set<string>,
  includeHidden: boolean
): PlainObject => {
  const { include, exclude, forceInclude } = projection;

  let working = cloneDeep(source);

  if (include.size > 0) {
    const partial: PlainObject = {};
    include.forEach(path => {
      const value = getPath(working, path);
      if (value !== undefined) {
        setPath(partial, path, value);
      }
    });

    if (source._id !== undefined) {
      partial._id = cloneDeep(source._id);
    }

    forceInclude.forEach(path => {
      const value = getPath(working, path);
      if (value !== undefined) {
        setPath(partial, path, value);
      }
    });

    working = partial;
  }

  exclude.forEach(path => {
    unsetPath(working, path);
  });

  if (!includeHidden) {
    hiddenFields.forEach(path => {
      if (forceInclude.has(path) || include.has(path)) {
        return;
      }

      unsetPath(working, path);
    });
  }

  return working;
};

const extractEqualityFields = (filter: PlainObject): PlainObject => {
  const normalized = normalizeQueryValue(filter);
  const payload: PlainObject = {};

  Object.entries(normalized).forEach(([key, value]) => {
    if (key.startsWith('$')) {
      return;
    }

    if (isObject(value)) {
      if (Object.keys(value).some(entry => entry.startsWith('$'))) {
        return;
      }
    }

    payload[key] = value;
  });

  return payload;
};

const valuesEqual = (a: any, b: any): boolean => {
  const left = normalizeQueryValue(a);
  const right = normalizeQueryValue(b);

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;
    return left.every((entry, index) => valuesEqual(entry, right[index]));
  }

  if (isObject(left) && isObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every(key => valuesEqual(left[key], right[key]));
  }

  return left === right;
};

const applyUpdatePayload = (doc: PlainObject, update: PlainObject, isInsert: boolean): PlainObject => {
  const result = cloneDeep(doc);
  const normalizedUpdate = normalizeQueryValue(update);
  const updateKeys = Object.keys(normalizedUpdate);

  const hasOperators = updateKeys.some(key => key.startsWith('$'));

  if (!hasOperators) {
    return {
      ...result,
      ...normalizedUpdate,
      _id: result._id || normalizedUpdate._id
    };
  }

  if (normalizedUpdate.$set) {
    Object.entries(normalizedUpdate.$set).forEach(([path, value]) => setPath(result, path, cloneDeep(value)));
  }

  if (normalizedUpdate.$unset) {
    Object.keys(normalizedUpdate.$unset).forEach(path => unsetPath(result, path));
  }

  if (normalizedUpdate.$inc) {
    Object.entries(normalizedUpdate.$inc).forEach(([path, value]) => {
      const current = getPath(result, path);
      const currentNumber = typeof current === 'number' ? current : 0;
      setPath(result, path, currentNumber + Number(value));
    });
  }

  if (normalizedUpdate.$push) {
    Object.entries(normalizedUpdate.$push).forEach(([path, value]) => {
      const current = getPath(result, path);
      const arr = Array.isArray(current) ? [...current] : [];
      if (isObject(value) && Array.isArray(value.$each)) {
        arr.push(...value.$each.map((entry: any) => cloneDeep(entry)));
      } else {
        arr.push(cloneDeep(value));
      }
      setPath(result, path, arr);
    });
  }

  if (normalizedUpdate.$addToSet) {
    Object.entries(normalizedUpdate.$addToSet).forEach(([path, value]) => {
      const current = getPath(result, path);
      const arr = Array.isArray(current) ? [...current] : [];
      const additions = isObject(value) && Array.isArray(value.$each) ? value.$each : [value];
      additions.forEach((entry: any) => {
        if (!arr.some(existing => valuesEqual(existing, entry))) {
          arr.push(cloneDeep(entry));
        }
      });
      setPath(result, path, arr);
    });
  }

  if (normalizedUpdate.$pull) {
    Object.entries(normalizedUpdate.$pull).forEach(([path, value]) => {
      const current = getPath(result, path);
      if (!Array.isArray(current)) {
        return;
      }

      const filtered = current.filter(item => {
        if (isObject(value) && Object.keys(value).some(key => key.startsWith('$'))) {
          const matcher = new Query(value as PlainObject);
          return !matcher.test(item);
        }

        return !valuesEqual(item, value);
      });

      setPath(result, path, filtered);
    });
  }

  if (isInsert && normalizedUpdate.$setOnInsert) {
    Object.entries(normalizedUpdate.$setOnInsert).forEach(([path, value]) => {
      setPath(result, path, cloneDeep(value));
    });
  }

  return result;
};

class ExecOperation<T> implements PromiseLike<T> {
  private runPromise?: Promise<T>;

  constructor(private readonly runner: () => Promise<T>) {}

  public exec(): Promise<T> {
    if (!this.runPromise) {
      this.runPromise = this.runner();
    }

    return this.runPromise;
  }

  public then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.exec().then(onfulfilled, onrejected);
  }

  public catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
  ): Promise<T | TResult> {
    return this.exec().catch(onrejected);
  }

  public finally(onfinally?: (() => void) | null): Promise<T> {
    return this.exec().finally(onfinally || undefined);
  }
}

const applySort = (docs: PlainObject[], sort?: SortSpec): PlainObject[] => {
  if (!sort || !Object.keys(sort).length) {
    return docs;
  }

  const entries = Object.entries(sort);
  return [...docs].sort((a, b) => {
    for (const [path, direction] of entries) {
      const av = getPath(a, path);
      const bv = getPath(b, path);
      if (av === bv) continue;

      const factor = direction === -1 ? -1 : 1;
      if (av === undefined || av === null) return -1 * factor;
      if (bv === undefined || bv === null) return 1 * factor;
      if (av > bv) return 1 * factor;
      if (av < bv) return -1 * factor;
    }
    return 0;
  });
};

const FALLBACK_REF_MAP: Record<string, string> = {
  userId: 'User',
  senderId: 'User',
  recipientId: 'User',
  participants: 'User',
  inviterId: 'User',
  inviteeId: 'User',
  creatorId: 'User',
  referrerId: 'User',
  referredUserId: 'User',
  influencerId: 'User',
  ownerUserId: 'User',
  partnerId: 'Partner',
  partnerCodeId: 'PartnerCode',
  partnerTargetId: 'PartnerTarget',
  payoutBatchId: 'PartnerPayoutBatch',
  groupId: 'StudyGroup',
  couponId: 'Coupon',
  achievementId: 'Achievement',
  evaluationId: 'TestEvaluation',
  questionId: 'IELTSQuestion',
  testSessionId: 'TestSession'
};

const inferTableFromModelName = (modelName: string): string => {
  if (MODEL_TABLE_MAP[modelName]) {
    return MODEL_TABLE_MAP[modelName];
  }

  const snake = modelName
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/-/g, '_')
    .toLowerCase();

  return snake.endsWith('s') ? snake : `${snake}s`;
};

const warnFallbackMode = (mode: string, label: string): void => {
  const key = `${label}:${mode}`;
  if (warnedModes.has(key)) {
    return;
  }

  warnedModes.add(key);
  log.warn(`DB ${label} mode '${mode}' is not available in this build. Falling back to Supabase.`);
};

const getEffectiveReadMode = (): 'supabase' => {
  if (env.db.readMode === 'mongo') {
    warnFallbackMode(env.db.readMode, 'read');
  }

  return 'supabase';
};

const getEffectiveWriteMode = (): 'supabase' | 'dual' => {
  if (env.db.writeMode === 'mongo') {
    warnFallbackMode(env.db.writeMode, 'write');
    return 'supabase';
  }

  return env.db.writeMode === 'dual' ? 'dual' : 'supabase';
};

const extractTextSearch = (filter: PlainObject): { remaining: PlainObject; search?: string } => {
  const clone = cloneDeep(filter);
  const textSpec = clone.$text;
  if (textSpec && typeof textSpec.$search === 'string') {
    delete clone.$text;
    return { remaining: clone, search: textSpec.$search.toLowerCase() };
  }

  return { remaining: clone };
};

const matchesFilter = (doc: PlainObject, filter: PlainObject): boolean => {
  const normalizedFilter = normalizeQueryValue(filter);
  const { remaining, search } = extractTextSearch(normalizedFilter);

  if (search) {
    const haystack = JSON.stringify(doc).toLowerCase();
    if (!haystack.includes(search)) {
      return false;
    }
  }

  const matcher = new Query(remaining as PlainObject);
  return matcher.test(doc);
};

const runPreSaveHook = async <T>(hook: PreSaveHook<T>, document: T): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    let done = false;

    const next = (error?: Error) => {
      if (done) return;
      done = true;
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    Promise.resolve(hook.call(document, next)).then(() => {
      if (!done) {
        resolve();
      }
    }).catch(reject);
  });
};

const descriptorKeys = new Set([
  'type',
  'required',
  'default',
  'index',
  'unique',
  'sparse',
  'trim',
  'lowercase',
  'uppercase',
  'enum',
  'min',
  'max',
  'minlength',
  'maxlength',
  'match',
  'select',
  'ref',
  'validate',
  'of'
]);

const isFieldDescriptor = (value: any): boolean => {
  if (!isObject(value)) return false;
  const keys = Object.keys(value);
  if (keys.length === 0) return false;
  if (!keys.includes('type')) return false;

  return keys.every(key => descriptorKeys.has(key));
};

const assignDefaultAtPath = (defaults: PlainObject, path: string, value: any): void => {
  if (!path) {
    return;
  }

  setPath(defaults, path, cloneDeep(value));
};

const extractSchemaMetadataFromDefinition = (definition: PlainObject, path: string, metadata: SchemaMetadata): void => {
  Object.entries(definition).forEach(([key, raw]) => {
    const currentPath = path ? `${path}.${key}` : key;

    if (Array.isArray(raw)) {
      assignDefaultAtPath(metadata.defaults, currentPath, []);

      if (raw.length === 1 && isFieldDescriptor(raw[0])) {
        const descriptor = raw[0];
        if (descriptor.ref) {
          metadata.refs.set(currentPath, descriptor.ref);
        }
      }

      return;
    }

    if (isFieldDescriptor(raw)) {
      const descriptor = raw;

      if (descriptor.default !== undefined) {
        const nextDefault = typeof descriptor.default === 'function' ? descriptor.default() : descriptor.default;
        assignDefaultAtPath(metadata.defaults, currentPath, nextDefault);
      }

      if (descriptor.select === false) {
        metadata.hiddenFields.add(currentPath);
      }

      if (descriptor.ref) {
        metadata.refs.set(currentPath, descriptor.ref);
      }

      if (descriptor.type === Map || descriptor.type === 'Map') {
        metadata.mapFields.add(currentPath);
      }

      if (descriptor.type === Array) {
        assignDefaultAtPath(metadata.defaults, currentPath, []);
      }

      if (Array.isArray(descriptor.type) && descriptor.type.length === 1 && isFieldDescriptor(descriptor.type[0])) {
        const inner = descriptor.type[0];
        if (inner.ref) {
          metadata.refs.set(currentPath, inner.ref);
        }
      }

      return;
    }

    if (isObject(raw)) {
      extractSchemaMetadataFromDefinition(raw, currentPath, metadata);
    }
  });
};

export class Schema<T = any> {
  public static Types = {
    ObjectId: MongoObjectId,
    Mixed: Object,
    Map
  };

  public obj: PlainObject;
  public options: PlainObject;
  public methods: Record<string, (this: any, ...args: any[]) => any> = {};
  private preSaveHooks: PreSaveHook<any>[] = [];
  private virtualGetters: Map<string, (this: any, ...args: any[]) => any> = new Map();
  private cachedMetadata?: SchemaMetadata;

  constructor(definition: PlainObject = {}, options: PlainObject = {}) {
    this.obj = definition;
    this.options = options;
  }

  public index(_fields?: any, _options?: any): this {
    return this;
  }

  public pre(event: string, hook: PreSaveHook<any>): this {
    if (event === 'save') {
      this.preSaveHooks.push(hook);
    }
    return this;
  }

  public virtual(path: string): { get: (getter: (this: any, ...args: any[]) => any) => Schema<T> } {
    return {
      get: (getter: (this: any, ...args: any[]) => any) => {
        this.virtualGetters.set(path, getter);
        return this;
      }
    };
  }

  public getPreSaveHooks(): PreSaveHook<any>[] {
    return this.preSaveHooks;
  }

  public getVirtualGetters(): Map<string, (this: any, ...args: any[]) => any> {
    return this.virtualGetters;
  }

  public getMetadata(): SchemaMetadata {
    if (this.cachedMetadata) {
      return this.cachedMetadata;
    }

    const metadata: SchemaMetadata = {
      defaults: {},
      hiddenFields: new Set(),
      refs: new Map(),
      mapFields: new Set(),
      timestamps: {}
    };

    extractSchemaMetadataFromDefinition(this.obj, '', metadata);

    if (this.options.timestamps) {
      if (this.options.timestamps === true) {
        metadata.timestamps.createdAt = 'createdAt';
        metadata.timestamps.updatedAt = 'updatedAt';
      } else if (isObject(this.options.timestamps)) {
        const createdAtOption = this.options.timestamps.createdAt;
        const updatedAtOption = this.options.timestamps.updatedAt;

        metadata.timestamps.createdAt =
          createdAtOption === false ? undefined : typeof createdAtOption === 'string' ? createdAtOption : 'createdAt';
        metadata.timestamps.updatedAt =
          updatedAtOption === false ? undefined : typeof updatedAtOption === 'string' ? updatedAtOption : 'updatedAt';
      }
    }

    this.cachedMetadata = metadata;
    return metadata;
  }
}

export class CompatDocument<T = any> {
  [key: string]: any;

  constructor(model: any, payload: PlainObject = {}, isNew: boolean = true) {
    Object.defineProperty(this, INTERNAL_MODEL, {
      enumerable: false,
      configurable: false,
      writable: false,
      value: model
    });

    Object.defineProperty(this, INTERNAL_STATE, {
      enumerable: false,
      configurable: false,
      writable: true,
      value: {
        isNew,
        original: cloneDeep(toPlainSerializable(payload))
      } as CompatState
    });

    Object.assign(this, payload);

    const schema: Schema = model.schema;
    schema.getVirtualGetters().forEach((getter, key) => {
      if (Object.prototype.hasOwnProperty.call(this, key)) {
        return;
      }

      Object.defineProperty(this, key, {
        enumerable: true,
        configurable: true,
        get: () => getter.call(this)
      });
    });

    Object.entries(schema.methods).forEach(([key, fn]) => {
      if (typeof fn === 'function' && !Object.prototype.hasOwnProperty.call(this, key)) {
        Object.defineProperty(this, key, {
          enumerable: false,
          configurable: true,
          writable: true,
          value: fn.bind(this)
        });
      }
    });
  }

  public isModified(path?: string): boolean {
    const state: CompatState = (this as any)[INTERNAL_STATE];
    if (!state) return true;

    if (state.isNew) return true;

    const current = toPlainSerializable(this.toObject({ includeHidden: true }));
    if (!path) {
      return !valuesEqual(current, state.original);
    }

    return !valuesEqual(getPath(current, path), getPath(state.original, path));
  }

  public toObject(options?: { includeHidden?: boolean; applyTransforms?: boolean; [key: string]: any }): PlainObject {
    const model = (this as any)[INTERNAL_MODEL];
    const metadata: SchemaMetadata = model.schema.getMetadata();

    const source: PlainObject = {};
    Object.keys(this).forEach(key => {
      source[key] = cloneDeep((this as any)[key]);
    });

    const projected = applyProjection(source, parseProjection(undefined), metadata.hiddenFields, options?.includeHidden || false);

    const transform = model.schema.options?.toObject?.transform;
    if (options?.applyTransforms !== false && typeof transform === 'function') {
      const transformed = cloneDeep(projected);
      transform(this, transformed);
      return transformed;
    }

    return projected;
  }

  public toJSON(): PlainObject {
    const model = (this as any)[INTERNAL_MODEL];
    const output = this.toObject();

    const transform = model.schema.options?.toJSON?.transform;
    if (typeof transform === 'function') {
      const transformed = cloneDeep(output);
      transform(this, transformed);
      return transformed;
    }

    return output;
  }

  public async save(): Promise<this> {
    const model = (this as any)[INTERNAL_MODEL];
    await model.__saveDocument(this);
    return this;
  }
}

class CompatQuery<T = any> implements PromiseLike<T> {
  private readonly projection?: string | PlainObject;
  private readonly sortSpec?: SortSpec;
  private readonly skipCount?: number;
  private readonly limitCount?: number;
  private readonly populateSpecs: PopulateSpec[];
  private readonly shouldLean: boolean;

  constructor(private readonly model: any, private readonly options: FindOptions) {
    this.projection = options.projection;
    this.sortSpec = options.sort;
    this.skipCount = options.skip;
    this.limitCount = options.limit;
    this.populateSpecs = options.populate || [];
    this.shouldLean = !!options.lean;
  }

  public select(fields: string | PlainObject): CompatQuery<T> {
    return new CompatQuery<T>(this.model, {
      ...this.options,
      projection: fields
    });
  }

  public sort(fields: SortSpec): CompatQuery<T> {
    return new CompatQuery<T>(this.model, {
      ...this.options,
      sort: fields
    });
  }

  public skip(value: number): CompatQuery<T> {
    return new CompatQuery<T>(this.model, {
      ...this.options,
      skip: value
    });
  }

  public limit(value: number): CompatQuery<T> {
    return new CompatQuery<T>(this.model, {
      ...this.options,
      limit: value
    });
  }

  public populate(pathOrSpec: string | PopulateSpec | PopulateSpec[] | any, select?: string): CompatQuery<T> {
    const specs = [...this.populateSpecs];

    const pushSpec = (entry: any) => {
      if (!entry) return;
      if (typeof entry === 'string') {
        specs.push({ path: entry, select });
        return;
      }

      if (isObject(entry) && typeof entry.path === 'string') {
        specs.push({ path: entry.path, select: entry.select });
      }
    };

    if (Array.isArray(pathOrSpec)) {
      pathOrSpec.forEach(pushSpec);
    } else {
      pushSpec(pathOrSpec);
    }

    return new CompatQuery<T>(this.model, {
      ...this.options,
      populate: specs
    });
  }

  public lean<R = any>(): CompatQuery<R> {
    return new CompatQuery<R>(this.model, {
      ...this.options,
      lean: true
    });
  }

  private async resolvePopulate(doc: PlainObject, populateSpec: PopulateSpec): Promise<void> {
    const path = populateSpec.path;
    const metadata: SchemaMetadata = this.model.schema.getMetadata();
    const refName = metadata.refs.get(path) || FALLBACK_REF_MAP[path];

    if (!refName) {
      return;
    }

    const refModel = modelRegistry.get(refName);
    if (!refModel) {
      return;
    }

    const current = getPath(doc, path);
    if (current === undefined || current === null) {
      return;
    }

    const projection = parseProjection(populateSpec.select);

    if (Array.isArray(current)) {
      const populated: PlainObject[] = [];

      for (const entry of current) {
        const rawId = String(normalizeQueryValue(entry) || '').trim();
        if (!rawId) {
          continue;
        }
        const lookupId = normalizeMongoStyleId(rawId) || rawId;

        const refDoc = await refModel.findById(lookupId).lean().exec();
        if (!refDoc) continue;

        populated.push(applyProjection(refDoc, projection, refModel.schema.getMetadata().hiddenFields, false));
      }

      setPath(doc, path, populated);
      return;
    }

    const rawId = String(normalizeQueryValue(current) || '').trim();
    if (!rawId) {
      return;
    }
    const lookupId = normalizeMongoStyleId(rawId) || rawId;

    const refDoc = await refModel.findById(lookupId).lean().exec();
    if (!refDoc) {
      return;
    }

    setPath(doc, path, applyProjection(refDoc, projection, refModel.schema.getMetadata().hiddenFields, false));
  }

  public async exec(): Promise<any> {
    const metadata: SchemaMetadata = this.model.schema.getMetadata();
    const queriedRows = await this.model.__queryRows({
      filter: this.options.filter || {},
      sort: this.sortSpec,
      skip: this.skipCount,
      limit: this.limitCount,
      single: this.options.single
    } as QueryRowsOptions);

    let sliced = queriedRows;
    if (!sliced) {
      const rows = await this.model.__loadRows();
      const filtered = rows.filter((row: PlainObject) => matchesFilter(row, this.options.filter || {}));
      const sorted = applySort(filtered, this.sortSpec);
      const skip = this.skipCount || 0;
      const limit = this.limitCount;
      sliced = sorted.slice(skip, limit !== undefined ? skip + limit : undefined);
    }

    const hydrated = sliced.map((raw: PlainObject) => {
      const value = hydrateValue(raw, '', metadata.mapFields) as PlainObject;
      return value;
    });

    for (const spec of this.populateSpecs) {
      // eslint-disable-next-line no-await-in-loop
      for (const doc of hydrated) {
        // eslint-disable-next-line no-await-in-loop
        await this.resolvePopulate(doc, spec);
      }
    }

    const projection = parseProjection(this.projection);
    const projected = hydrated.map(doc => applyProjection(doc, projection, metadata.hiddenFields, false));

    const materialize = (doc: PlainObject): any => {
      if (this.shouldLean) {
        return cloneDeep(doc);
      }

      return this.model.__hydrateDocument(doc, false);
    };

    if (this.options.single) {
      const one = projected[0];
      return one ? materialize(one) : null;
    }

    return projected.map(materialize);
  }

  public then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.exec().then(onfulfilled, onrejected);
  }

  public catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
  ): Promise<T | TResult> {
    return this.exec().catch(onrejected);
  }

  public finally(onfinally?: (() => void) | null): Promise<T> {
    return this.exec().finally(onfinally || undefined);
  }
}

const modelRegistry = new Map<string, any>();

const createDocumentClass = (name: string, schema: Schema): any => {
  const tableName = inferTableFromModelName(name);

  class SupabaseCompatModel extends CompatDocument {
    public static modelName = name;
    public static tableName = tableName;
    public static schema = schema;

    constructor(payload: PlainObject = {}) {
      const defaults = schema.getMetadata().defaults;
      const merged = mergeDeep(defaults, payload || {});
      const hydrated = hydrateValue(merged, '', schema.getMetadata().mapFields);
      super(SupabaseCompatModel, hydrated, true);
    }

    public static __hydrateDocument(payload: PlainObject, isNew: boolean): CompatDocument {
      const instance = new SupabaseCompatModel(payload);
      const state: CompatState = (instance as any)[INTERNAL_STATE];
      state.isNew = isNew;
      state.original = cloneDeep(toPlainSerializable(payload));
      return instance;
    }

    public static async __loadRows(): Promise<PlainObject[]> {
      void getEffectiveReadMode();

      const rows = await loadTableRows(this.tableName);
      return this.__mapStoredRows(rows);
    }

    private static __mapStoredRows(rows: Array<{ id: string; data: PlainObject; createdAt: string; updatedAt: string }>): PlainObject[] {
      return rows.map(row => {
        const data = cloneDeep(row.data || {});
        data._id = row.id;

        const createdAtField = schema.getMetadata().timestamps.createdAt;
        const updatedAtField = schema.getMetadata().timestamps.updatedAt;

        if (createdAtField && data[createdAtField] === undefined && row.createdAt) {
          data[createdAtField] = row.createdAt;
        }

        if (updatedAtField && data[updatedAtField] === undefined && row.updatedAt) {
          data[updatedAtField] = row.updatedAt;
        }

        return data;
      });
    }

    public static async __queryRows(options: QueryRowsOptions): Promise<PlainObject[] | null> {
      void getEffectiveReadMode();

      const rows = await queryTableRows(this.tableName, {
        filter: options.filter || {},
        sort: options.sort,
        skip: options.skip,
        limit: options.limit,
        single: options.single
      });
      if (!rows) return null;
      return this.__mapStoredRows(rows);
    }

    public static async __countRows(filter: PlainObject = {}): Promise<number | null> {
      void getEffectiveReadMode();
      return countTableRows(this.tableName, filter || {});
    }

    public static async __saveDocument(document: CompatDocument): Promise<void> {
      const mode = getEffectiveWriteMode();
      if (mode === 'dual' && env.db.parityLogging) {
        log.info(`DB parity logging (dual-write simulated): ${this.modelName}`);
      }

      const metadata = schema.getMetadata();
      const state: CompatState = (document as any)[INTERNAL_STATE];

      for (const hook of schema.getPreSaveHooks()) {
        // eslint-disable-next-line no-await-in-loop
        await runPreSaveHook(hook as PreSaveHook<any>, document as any);
      }

      const payload = toPlainSerializable(
        document.toObject({ includeHidden: true, applyTransforms: false })
      ) as PlainObject;

      const normalizedExistingId = normalizeMongoStyleId(String(payload._id || ''));
      const nextId = normalizedExistingId || generateMongoStyleId();
      payload._id = nextId;

      const createdAtField = metadata.timestamps.createdAt;
      const updatedAtField = metadata.timestamps.updatedAt;

      const nowIso = new Date().toISOString();
      if (createdAtField) {
        payload[createdAtField] = state.isNew ? payload[createdAtField] || nowIso : payload[createdAtField] || state.original[createdAtField] || nowIso;
      }
      if (updatedAtField) {
        payload[updatedAtField] = nowIso;
      }

      await upsertRow(this.tableName, nextId, payload, createdAtField ? payload[createdAtField] : undefined);

      Object.keys(document).forEach(key => {
        delete (document as any)[key];
      });

      const hydrated = hydrateValue(payload, '', metadata.mapFields);
      Object.assign(document, hydrated);

      state.isNew = false;
      state.original = cloneDeep(payload);
    }

    public static create(payload: PlainObject): ExecOperation<any> {
      return new ExecOperation(async () => {
        const document = new SupabaseCompatModel(payload);
        await document.save();
        return document;
      });
    }

    public static insertMany(payloads: PlainObject[]): ExecOperation<any[]> {
      return new ExecOperation(async () => {
        const result: any[] = [];

        for (const payload of payloads) {
          const document = new SupabaseCompatModel(payload);
          // eslint-disable-next-line no-await-in-loop
          await document.save();
          result.push(document);
        }

        return result;
      });
    }

    public static find(filter: PlainObject = {}): CompatQuery<any[]> {
      return new CompatQuery<any[]>(this, { single: false, filter });
    }

    public static findOne(filter: PlainObject = {}): CompatQuery<any | null> {
      return new CompatQuery<any | null>(this, { single: true, filter });
    }

    public static findById(id: string | MongoObjectId): CompatQuery<any | null> {
      const normalized = normalizeQueryValue(id);
      return new CompatQuery<any | null>(this, {
        single: true,
        filter: { _id: normalized }
      });
    }

    private static async updateInternal(
      filter: PlainObject,
      update: PlainObject,
      options: PlainObject = {},
      multi: boolean
    ): Promise<{ matchedCount: number; modifiedCount: number; upsertedCount: number; upsertedId?: string }> {
      let matched = await this.__queryRows({
        filter: filter || {},
        single: multi ? false : true
      });

      if (!matched) {
        const rows = await this.__loadRows();
        matched = rows.filter((row: PlainObject) => matchesFilter(row, filter || {}));
      }

      const limitedMatched = multi ? matched : matched.slice(0, 1);

      let modifiedCount = 0;

      for (const row of limitedMatched) {
        const next = applyUpdatePayload(row, update || {}, false);
        if (!next._id) {
          next._id = row._id;
        }

        // eslint-disable-next-line no-await-in-loop
        await upsertRow(this.tableName, next._id, next, next.createdAt);
        modifiedCount += 1;
      }

      if (!limitedMatched.length && options.upsert) {
        const upsertPayload = mergeDeep(extractEqualityFields(filter || {}), {});
        const next = applyUpdatePayload(upsertPayload, update || {}, true);
        if (!next._id) {
          next._id = generateMongoStyleId();
        }

        await upsertRow(this.tableName, next._id, next, next.createdAt);

        return {
          matchedCount: 0,
          modifiedCount: 0,
          upsertedCount: 1,
          upsertedId: next._id
        };
      }

      return {
        matchedCount: limitedMatched.length,
        modifiedCount,
        upsertedCount: 0
      };
    }

    public static updateOne(filter: PlainObject, update: PlainObject, options: PlainObject = {}): ExecOperation<any> {
      return new ExecOperation(() => this.updateInternal(filter, update, options, false));
    }

    public static updateMany(filter: PlainObject, update: PlainObject, options: PlainObject = {}): ExecOperation<any> {
      return new ExecOperation(() => this.updateInternal(filter, update, options, true));
    }

    public static deleteOne(filter: PlainObject): ExecOperation<{ deletedCount: number }> {
      return new ExecOperation(async () => {
        const rows = await this.__loadRows();
        const first = rows.find((row: PlainObject) => matchesFilter(row, filter || {}));
        if (!first) {
          return { deletedCount: 0 };
        }

        const deletedCount = await deleteRowsByIds(this.tableName, [first._id]);
        return { deletedCount };
      });
    }

    public static deleteMany(filter: PlainObject): ExecOperation<{ deletedCount: number }> {
      return new ExecOperation(async () => {
        const rows = await this.__loadRows();
        const ids = rows.filter((row: PlainObject) => matchesFilter(row, filter || {})).map((row: PlainObject) => row._id);
        const deletedCount = await deleteRowsByIds(this.tableName, ids);
        return { deletedCount };
      });
    }

    public static findByIdAndDelete(id: string | MongoObjectId): ExecOperation<any | null> {
      return new ExecOperation(async () => {
        const document = await this.findById(id).exec();
        if (!document) return null;

        await this.deleteOne({ _id: normalizeQueryValue(id) }).exec();
        return document;
      });
    }

    public static findOneAndDelete(filter: PlainObject): ExecOperation<any | null> {
      return new ExecOperation(async () => {
        const document = await this.findOne(filter).exec();
        if (!document) return null;

        await this.deleteOne(filter).exec();
        return document;
      });
    }

    public static findByIdAndUpdate(id: string | MongoObjectId, update: PlainObject, options: PlainObject = {}): ExecOperation<any> {
      return new ExecOperation(async () => {
        const normalizedId = normalizeQueryValue(id);
        const existing = await this.findById(normalizedId).exec();

        if (!existing && !options.upsert) {
          return null;
        }

        await this.updateOne({ _id: normalizedId }, update, options).exec();

        if (options.new || options.returnDocument === 'after') {
          return this.findById(normalizedId).exec();
        }

        return existing;
      });
    }

    public static findOneAndUpdate(filter: PlainObject, update: PlainObject, options: PlainObject = {}): ExecOperation<any> {
      return new ExecOperation(async () => {
        const existing = await this.findOne(filter).exec();

        if (!existing && !options.upsert) {
          return null;
        }

        const result = await this.updateOne(filter, update, options).exec();

        if (options.upsert && result.upsertedId && !existing) {
          return this.findById(result.upsertedId).exec();
        }

        if (options.new || options.returnDocument === 'after') {
          return this.findOne(filter).exec();
        }

        return existing;
      });
    }

    public static countDocuments(filter: PlainObject = {}): ExecOperation<number> {
      return new ExecOperation(async () => {
        const pushedCount = await this.__countRows(filter || {});
        if (pushedCount !== null) {
          return pushedCount;
        }

        const rows = await this.__loadRows();
        return rows.filter((row: PlainObject) => matchesFilter(row, filter || {})).length;
      });
    }

    public static distinct(path: string, filter: PlainObject = {}): ExecOperation<any[]> {
      return new ExecOperation(async () => {
        const rows = await this.__loadRows();
        const values = rows
          .filter((row: PlainObject) => matchesFilter(row, filter || {}))
          .map((row: PlainObject) => getPath(row, path))
          .filter(value => value !== undefined);

        const unique = new Map<string, any>();
        values.forEach(value => {
          unique.set(JSON.stringify(normalizeQueryValue(value)), value);
        });

        return Array.from(unique.values());
      });
    }

    public static exists(filter: PlainObject = {}): ExecOperation<boolean> {
      return new ExecOperation(async () => {
        const pushedCount = await this.__countRows(filter || {});
        if (pushedCount !== null) {
          return pushedCount > 0;
        }

        const rows = await this.__loadRows();
        return rows.some((row: PlainObject) => matchesFilter(row, filter || {}));
      });
    }

    public static aggregate(pipeline: PlainObject[]): ExecOperation<any[]> {
      return new ExecOperation(async () => {
        const rows = await this.__loadRows();
        const normalizedPipeline = normalizeQueryValue(pipeline);
        const aggregator = new Aggregator(normalizedPipeline as any[]);
        const result = aggregator.run(rows);

        return result.map(entry => hydrateValue(entry, '', this.schema.getMetadata().mapFields));
      });
    }
  }

  return SupabaseCompatModel;
};

export const model = <T = any>(name: string, schema: Schema): any => {
  if (modelRegistry.has(name)) {
    return modelRegistry.get(name);
  }

  const modelClass = createDocumentClass(name, schema);
  modelRegistry.set(name, modelClass);
  return modelClass;
};

export type Document = CompatDocument<any>;
export type HydratedDocument<T> = CompatDocument<T>;
export type FilterQuery<T> = PlainObject;
export type PopulateOptions = PopulateSpec;
export type Model<T> = any;

export namespace Types {
  export const ObjectId = MongoObjectId;
  export type ObjectId = MongoObjectId;
}

export const connection = {
  readyState: 0,
  host: 'supabase',
  name: 'postgres',
  getClient: () => null,
  db: null
};

export const set = (_key: string, _value: any): void => {
  // no-op for compatibility
};

export const connect = async (_connectionString?: string): Promise<any> => {
  await checkPgConnection();
  connection.readyState = 1;
  return { connection };
};

const mongooseCompat = {
  Schema,
  model,
  Types,
  connect,
  set,
  connection
};

export default mongooseCompat;
