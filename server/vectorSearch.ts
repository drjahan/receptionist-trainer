/**
 * vectorSearch.ts
 * RAG retrieval layer — connects to the pgvector PostgreSQL database on Railway
 * and retrieves the most relevant policy chunks for a given query.
 *
 * The DGX Spark handles all embedding ingestion.
 * This module handles query-time embedding + similarity search.
 */

import pg from "pg";
import { invokeLLM } from "./_core/llm";

const { Pool } = pg;

// ─── pgvector DB connection (separate from the main MySQL DB) ─────────────────

let pgPool: pg.Pool | null = null;

function getVectorPool(): pg.Pool {
  if (!pgPool) {
    const connStr = process.env.PGVECTOR_DATABASE_URL;
    if (!connStr) {
      throw new Error("PGVECTOR_DATABASE_URL environment variable is not set");
    }
    pgPool = new Pool({
      connectionString: connStr,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pgPool;
}

// ─── Embedding generation ─────────────────────────────────────────────────────

/**
 * Generate an embedding for a query string using the same model as the DGX.
 * We use OpenAI's text-embedding-3-small (1536 dims) as the fallback until
 * the DGX confirms its sentence-transformers model dimensions.
 *
 * NOTE: Once DGX confirms the model (e.g. all-mpnet-base-v2 = 768 dims),
 * we will switch to calling the DGX embedding endpoint directly to keep
 * the vector space consistent.
 */
async function embedQuery(text: string): Promise<number[]> {
  // Use OpenAI embeddings via the built-in LLM API
  // We call the embeddings endpoint directly
  const apiUrl = process.env.BUILT_IN_FORGE_API_URL || "https://api.openai.com/v1";
  const apiKey = process.env.BUILT_IN_FORGE_API_KEY;

  if (!apiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY not set");
  }

  const response = await fetch(`${apiUrl}/embeddings`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
      dimensions: 768, // Request 768 dims to match DGX sentence-transformers
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding API error: ${response.status} ${err}`);
  }

  const data = await response.json() as { data: Array<{ embedding: number[] }> };
  return data.data[0].embedding;
}

// ─── Policy chunk retrieval ───────────────────────────────────────────────────

export interface PolicyChunk {
  id: number;
  documentName: string;
  folderName: string;
  category: string;
  chunkIndex: number;
  content: string;
  similarity: number;
}

/**
 * Retrieve the top-k most relevant policy chunks for a given query.
 * Uses cosine similarity search via pgvector.
 */
export async function retrieveRelevantPolicies(
  query: string,
  options: {
    topK?: number;
    category?: "clinical" | "non-clinical" | "all";
    minSimilarity?: number;
  } = {}
): Promise<PolicyChunk[]> {
  const { topK = 5, category = "all", minSimilarity = 0.3 } = options;

  try {
    const pool = getVectorPool();
    const embedding = await embedQuery(query);

    // Format embedding as pgvector literal
    const embeddingStr = `[${embedding.join(",")}]`;

    let whereClause = "";
    const params: (string | number)[] = [embeddingStr, minSimilarity, topK];

    if (category !== "all") {
      whereClause = "AND category = $4";
      params.push(category);
    }

    const sql = `
      SELECT
        id,
        document_name AS "documentName",
        folder_name AS "folderName",
        category,
        chunk_index AS "chunkIndex",
        content,
        1 - (embedding <=> $1::vector) AS similarity
      FROM policy_chunks
      WHERE embedding IS NOT NULL
        AND 1 - (embedding <=> $1::vector) >= $2
        ${whereClause}
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `;

    const result = await pool.query(sql, params);
    return result.rows as PolicyChunk[];
  } catch (error) {
    // Graceful degradation — if vector DB is unavailable, return empty
    console.error("[vectorSearch] Failed to retrieve policies:", error);
    return [];
  }
}

/**
 * Format retrieved policy chunks into a concise context block
 * suitable for injection into a scoring prompt.
 */
export function formatPolicyContext(chunks: PolicyChunk[]): string {
  if (chunks.length === 0) {
    return "";
  }

  const lines = [
    "RELEVANT GP PATHFINDER POLICIES (retrieved from policy database):",
    "Use these to assess whether the receptionist followed correct practice:",
    "",
  ];

  for (const chunk of chunks) {
    lines.push(`--- ${chunk.documentName} (${chunk.folderName}) ---`);
    lines.push(chunk.content.trim());
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Check if the vector database is available and has data.
 */
export async function getVectorDbStats(): Promise<{
  available: boolean;
  totalChunks: number;
  clinicalChunks: number;
  nonClinicalChunks: number;
}> {
  try {
    const pool = getVectorPool();
    const result = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE category = 'clinical') AS clinical,
        COUNT(*) FILTER (WHERE category = 'non-clinical') AS non_clinical
      FROM policy_chunks
      WHERE embedding IS NOT NULL
    `);
    const row = result.rows[0];
    return {
      available: true,
      totalChunks: parseInt(row.total),
      clinicalChunks: parseInt(row.clinical),
      nonClinicalChunks: parseInt(row.non_clinical),
    };
  } catch {
    return { available: false, totalChunks: 0, clinicalChunks: 0, nonClinicalChunks: 0 };
  }
}
