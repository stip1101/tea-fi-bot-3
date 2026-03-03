import { openai, aiLogger } from './openai-client';
import { readdirSync, createReadStream } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = join(__dirname, '..', 'knowledge');

/**
 * Ensure OpenAI client is available, throw descriptive error if not
 */
function requireOpenAI() {
  if (!openai) {
    throw new Error('OpenAI client not initialized - OPENAI_API_KEY is required');
  }
  return openai;
}

/**
 * Create a new vector store for the TeaFi program knowledge base
 */
export async function createVectorStore(): Promise<string> {
  const client = requireOpenAI();
  aiLogger.info('Creating new vector store...');

  const vectorStore = await client.vectorStores.create({
    name: 'teafi-knowledge-base',
    expires_after: {
      anchor: 'last_active_at',
      days: 90,
    },
    chunking_strategy: {
      type: 'static',
      static: {
        max_chunk_size_tokens: 800,
        chunk_overlap_tokens: 400,
      },
    },
    metadata: {
      project: 'teafi-bot',
      version: '1.0',
    },
  });

  aiLogger.info({ vectorStoreId: vectorStore.id }, 'Vector store created');
  return vectorStore.id;
}

/**
 * Upload knowledge base files to vector store
 */
export async function uploadKnowledgeBase(vectorStoreId: string): Promise<void> {
  const client = requireOpenAI();
  aiLogger.info({ vectorStoreId }, 'Uploading knowledge base files...');

  // Read all markdown files from knowledge directory
  let files: string[];
  try {
    files = readdirSync(KNOWLEDGE_DIR).filter((file) => file.endsWith('.md'));
  } catch (error) {
    aiLogger.error({ err: error }, 'Knowledge directory not found');
    throw new Error(`Knowledge directory not found: ${KNOWLEDGE_DIR}`);
  }

  if (files.length === 0) {
    throw new Error('No markdown files found in knowledge directory');
  }

  aiLogger.info({ fileCount: files.length }, 'Found knowledge base files');

  // Upload files as a batch
  const fileStreams = files.map((file) => createReadStream(join(KNOWLEDGE_DIR, file)));

  const batch = await client.vectorStores.fileBatches.uploadAndPoll(vectorStoreId, {
    files: fileStreams,
  });

  aiLogger.info(
    {
      status: batch.status,
      completed: batch.file_counts.completed,
      total: batch.file_counts.total,
      failed: batch.file_counts.failed,
    },
    'Knowledge base upload completed'
  );

  if (batch.file_counts.failed > 0) {
    aiLogger.warn(
      { failed: batch.file_counts.failed },
      'Some files failed to upload'
    );
  }
}

/**
 * Delete all files from vector store
 */
export async function clearVectorStoreFiles(vectorStoreId: string): Promise<void> {
  const client = requireOpenAI();
  aiLogger.info({ vectorStoreId }, 'Clearing existing files from vector store...');

  const files = await client.vectorStores.files.list(vectorStoreId);

  for await (const file of files) {
    await client.vectorStores.files.del(vectorStoreId, file.id);
    aiLogger.debug({ fileId: file.id }, 'Deleted file from vector store');
  }

  aiLogger.info({ vectorStoreId }, 'All files cleared from vector store');
}

/**
 * Get vector store info
 */
export async function getVectorStoreInfo(vectorStoreId: string): Promise<{
  name: string;
  status: string;
  fileCount: number;
  usageBytes: number;
  expiresAt: Date | null;
}> {
  const client = requireOpenAI();
  const vectorStore = await client.vectorStores.retrieve(vectorStoreId);

  return {
    name: vectorStore.name || 'Unknown',
    status: vectorStore.status,
    fileCount: vectorStore.file_counts.completed,
    usageBytes: vectorStore.usage_bytes,
    expiresAt: vectorStore.expires_at ? new Date(vectorStore.expires_at * 1000) : null,
  };
}

/**
 * Initialize vector store - creates new or validates existing
 * @param force - If true, re-uploads all files even if store exists
 */
export async function initializeVectorStore(force = false): Promise<string> {
  const existingId = process.env.OPENAI_VECTOR_STORE_ID;

  if (existingId) {
    try {
      const info = await getVectorStoreInfo(existingId);

      if (force) {
        aiLogger.info(
          { vectorStoreId: existingId },
          'Force flag set - re-uploading all files'
        );
        await clearVectorStoreFiles(existingId);
        await uploadKnowledgeBase(existingId);
        aiLogger.info({ vectorStoreId: existingId }, 'Knowledge base refreshed');
      } else {
        aiLogger.info(
          { vectorStoreId: existingId, ...info },
          'Using existing vector store'
        );
      }
      return existingId;
    } catch (error) {
      aiLogger.warn(
        { vectorStoreId: existingId, err: error },
        'Existing vector store not found, creating new one'
      );
    }
  }

  // Create new vector store and upload knowledge base
  const newId = await createVectorStore();
  await uploadKnowledgeBase(newId);

  aiLogger.info(
    { vectorStoreId: newId },
    'New vector store initialized. Add OPENAI_VECTOR_STORE_ID to .env'
  );

  return newId;
}
