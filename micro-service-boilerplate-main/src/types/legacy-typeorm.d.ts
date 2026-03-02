declare module 'typeorm' {
  export interface DeleteResult {
    affected?: number;
  }

  export class QueryBuilder<T = any> {
    where(condition: string, parameters?: Record<string, unknown>): this;
    andWhere(condition: string, parameters?: Record<string, unknown>): this;
    delete(): this;
    execute(): Promise<DeleteResult>;
    getCount(): Promise<number>;
  }

  export class Repository<T = any> {
    create(entityLike?: Partial<T>): T;
    save(entity: T | T[]): Promise<T>;
    find(options?: Record<string, unknown>): Promise<T[]>;
    createQueryBuilder(alias?: string): QueryBuilder<T>;
  }

  export class DataSource {
    constructor(options: Record<string, unknown>);
    initialize(): Promise<void>;
    destroy(): Promise<void>;
    getRepository<T = any>(target: unknown): Repository<T>;
  }

  export function Entity(name?: string): ClassDecorator;
  export function PrimaryGeneratedColumn(
    strategyOrOptions?: string | Record<string, unknown>
  ): PropertyDecorator;
  export function Column(options?: Record<string, unknown>): PropertyDecorator;
  export function CreateDateColumn(options?: Record<string, unknown>): PropertyDecorator;
  export function UpdateDateColumn(options?: Record<string, unknown>): PropertyDecorator;
}

declare module 'typeorm-typedi-extensions' {
  export function InjectRepository(entity: unknown): ParameterDecorator;
}
