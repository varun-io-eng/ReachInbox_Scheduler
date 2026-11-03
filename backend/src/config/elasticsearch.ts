import { Client } from '@elastic/elasticsearch';
import config from './index.js';

/**
 * Elasticsearch client instance.
 */
export const esClient = new Client({
  node: config.ELASTICSEARCH_URL,
});

const INDEX_NAME = 'emails';

/**
 * Mapping definition for the emails index.
 */
const EMAIL_INDEX_MAPPINGS = {
  properties: {
    id: { type: 'keyword' as const },
    user_id: { type: 'keyword' as const },
    subject: { type: 'text' as const, analyzer: 'standard' },
    body: { type: 'text' as const, analyzer: 'standard' },
    recipient_email: { type: 'keyword' as const, fields: { text: { type: 'text' as const } } },
    sender_email: { type: 'keyword' as const, fields: { text: { type: 'text' as const } } },
    status: { type: 'keyword' as const },
    batch_id: { type: 'keyword' as const },
    scheduled_at: { type: 'date' as const },
    sent_at: { type: 'date' as const },
    created_at: { type: 'date' as const },
  },
};

/**
 * Creates the `emails` index with proper mappings if it does not already exist.
 */
export async function createEmailIndex(): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index: INDEX_NAME });

    if (!exists) {
      await esClient.indices.create({
        index: INDEX_NAME,
        body: {
          mappings: EMAIL_INDEX_MAPPINGS,
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
          },
        },
      });
      console.log('[Elasticsearch] Created index:', INDEX_NAME);
    } else {
      console.log('[Elasticsearch] Index already exists:', INDEX_NAME);
    }
  } catch (error) {
    console.error('[Elasticsearch] Failed to create index:', error);
    // Non-fatal: service can start without ES
  }
}

/**
 * Index (upsert) an email document.
 */
export async function indexEmailDocument(doc: {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  recipient_email: string;
  sender_email: string;
  status: string;
  batch_id?: string | null;
  scheduled_at: string | Date;
  sent_at?: string | Date | null;
  created_at?: string | Date;
}): Promise<void> {
  try {
    await esClient.index({
      index: INDEX_NAME,
      id: doc.id,
      document: {
        ...doc,
        scheduled_at: new Date(doc.scheduled_at).toISOString(),
        sent_at: doc.sent_at ? new Date(doc.sent_at).toISOString() : null,
        created_at: doc.created_at ? new Date(doc.created_at).toISOString() : new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Elasticsearch] Failed to index document:', doc.id, error);
  }
}

/**
 * Search emails by query string across all text fields.
 */
export async function searchEmails(
  query: string,
  userId: string,
  options: { from?: number; size?: number } = {}
): Promise<{ hits: unknown[]; total: number }> {
  const { from = 0, size = 20 } = options;

  try {
    const result = await esClient.search({
      index: INDEX_NAME,
      body: {
        from,
        size,
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query,
                  fields: ['subject^3', 'body^2', 'recipient_email.text', 'sender_email.text'],
                  type: 'best_fields',
                  fuzziness: 'AUTO',
                },
              },
            ],
            filter: [{ term: { user_id: userId } }],
          },
        },
        sort: [{ scheduled_at: { order: 'desc' } }],
      },
    });

    const total =
      typeof result.hits.total === 'number' ? result.hits.total : result.hits.total?.value ?? 0;

    return {
      hits: result.hits.hits.map((hit: { _source?: unknown }) => hit._source),
      total,
    };
  } catch (error) {
    console.error('[Elasticsearch] Search failed:', error);
    return { hits: [], total: 0 };
  }
}

/**
 * Delete an email document from the index.
 */
export async function deleteEmailDocument(id: string): Promise<void> {
  try {
    await esClient.delete({ index: INDEX_NAME, id });
  } catch (error) {
    console.error('[Elasticsearch] Failed to delete document:', id, error);
  }
}

export default esClient;
