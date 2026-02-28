import { QdrantClient } from "@qdrant/js-client-rest";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const client = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
});

const getCollections = async () => {
    const result = await client.getCollections();
    return result.collections;
}

const createCollection = async (name: string) => {
    const result = await client.createCollection(name, {
        vectors: {
            size: 1536,
            distance: 'Cosine',
        },
    });
    return result;
}


async function embed(text: string) {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
  
    return response.data[0].embedding;
  }

  interface SaveTextEntryProps {
    collectionName: string;
    payload: Record<string, any>;
    id: string;
  }

  async function saveTextEntry({ collectionName, payload, id }: SaveTextEntryProps) {
    const vector = await embed(payload.text);
  
    await client.upsert(collectionName, {
      points: [
        {
          id,
          vector,
          payload: payload,
        },
      ],
    });
  }


  interface SearchSimilarProps {
    collectionName: string;
    query: string;
  }
  async function searchSimilar({ collectionName, query }: SearchSimilarProps) {
    const vector = await embed(query);
  
    const results = await client.search(collectionName, {
      vector,
      limit: 5,
      with_payload: true,
    });
  
    return results;
  }

async function deleteAllEntries(collectionName: string) {
  await client.delete(collectionName, {
    // La condition vide {} supprime tous les points dans la collection
    filter: {},
  });
}

export const qdrantTools = {
    getCollections,
    createCollection,
    saveTextEntry,
    searchSimilar,
    deleteAllEntries,
};
