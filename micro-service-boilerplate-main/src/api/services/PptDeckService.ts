/**
 * PPT Deck Service (in-memory stub)
 *
 * The old implementation used MongoDB. This app doesn't use PPT endpoints
 * in core user flows, so we keep a small in-memory store to satisfy the API
 * surface without any Mongo dependency.
 */

import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { Service } from 'typedi';

export type PptDeckVersionDocument = {
  sessionKey: string;
  version: number;
  deck: unknown;
  changeSummary?: string;
  createdAt: Date;
};

type DeckStore = Map<string, PptDeckVersionDocument[]>;
const store: DeckStore = new Map();

@Service()
export class PptDeckService {
  private log = new Logger(__filename);

  public async getLatest(sessionKey: string, headers: IRequestHeaders): Promise<PptDeckVersionDocument> {
    const logMessage = constructLogMessage(__filename, 'getLatest', headers);
    this.log.debug(`${logMessage} :: Fetching latest deck version`, { sessionKey });

    const versions = store.get(sessionKey) || [];
    const latest = versions[versions.length - 1];
    if (!latest) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Deck not found');
    }
    return latest;
  }

  public async getVersion(sessionKey: string, version: number, headers: IRequestHeaders): Promise<PptDeckVersionDocument> {
    const logMessage = constructLogMessage(__filename, 'getVersion', headers);
    this.log.debug(`${logMessage} :: Fetching deck version`, { sessionKey, version });

    const versions = store.get(sessionKey) || [];
    const doc = versions.find(v => v.version === version);
    if (!doc) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Deck version not found');
    }
    return doc;
  }

  public async listVersions(
    sessionKey: string,
    headers: IRequestHeaders
  ): Promise<Array<{ version: number; createdAt: Date; changeSummary?: string }>> {
    const logMessage = constructLogMessage(__filename, 'listVersions', headers);
    this.log.debug(`${logMessage} :: Listing deck versions`, { sessionKey });

    const versions = store.get(sessionKey) || [];
    return [...versions]
      .sort((a, b) => b.version - a.version)
      .map(v => ({ version: v.version, createdAt: v.createdAt, changeSummary: v.changeSummary }));
  }

  public async createInitialDeck(
    sessionKey: string,
    deck: unknown,
    changeSummary: string | undefined,
    headers: IRequestHeaders
  ): Promise<PptDeckVersionDocument> {
    const logMessage = constructLogMessage(__filename, 'createInitialDeck', headers);
    this.log.info(`${logMessage} :: Creating initial deck version`, { sessionKey });

    const versions = store.get(sessionKey) || [];
    if (versions.length) {
      throw new CSError(HTTP_STATUS_CODES.CONFLICT, CODES.InvalidBody, 'Deck already exists for session');
    }

    const doc: PptDeckVersionDocument = {
      sessionKey,
      version: 1,
      deck,
      changeSummary,
      createdAt: new Date()
    };

    store.set(sessionKey, [doc]);
    return doc;
  }

  public async reviseDeck(
    sessionKey: string,
    deck: unknown,
    changeSummary: string | undefined,
    headers: IRequestHeaders
  ): Promise<PptDeckVersionDocument> {
    const logMessage = constructLogMessage(__filename, 'reviseDeck', headers);
    this.log.info(`${logMessage} :: Creating revised deck version`, { sessionKey });

    const versions = store.get(sessionKey) || [];
    if (!versions.length) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Deck not found');
    }

    const nextVersion = (versions[versions.length - 1]?.version || 0) + 1;
    const doc: PptDeckVersionDocument = {
      sessionKey,
      version: nextVersion,
      deck,
      changeSummary,
      createdAt: new Date()
    };

    store.set(sessionKey, [...versions, doc]);
    return doc;
  }
}

