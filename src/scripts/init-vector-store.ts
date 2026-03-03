import { initializeVectorStore } from '../ai/vector-store';

const vectorStoreId = await initializeVectorStore(true);

console.log(`\nVector store ready: ${vectorStoreId}`);
console.log(`Add to .env: OPENAI_VECTOR_STORE_ID=${vectorStoreId}`);
