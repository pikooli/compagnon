import { qdrantTools } from "@/app/lib/qdrant";

const collectionName = 'conversations';

const getMessages = async (query: string) => {
    const messages = await qdrantTools.searchSimilar({ collectionName, query });
    return messages;
}

const saveMessage = async (message: string) => {
    const payload = {
        text: message,
        createdAt: Date.now(),
}
    await qdrantTools.saveTextEntry({ collectionName, payload, id: crypto.randomUUID() });
}

export const conversations = {
    getMessages,
    saveMessage,
};