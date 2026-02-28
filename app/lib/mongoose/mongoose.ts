export { ContactModel } from './schema/contact.schema';
export { MemoryModel } from './schema/memory.schema';
export { ProductModel } from './schema/product.schema';
import mongoose from 'mongoose';

mongoose.set('bufferCommands', false); // fail fast si pas connecté

let connectPromise: Promise<typeof mongoose> | null = null;

export async function connectMongo() {
  if (mongoose.connection.readyState === mongoose.ConnectionStates.connected)
    return mongoose;
  if (!connectPromise) {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI is missing');

    connectPromise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 30000,
    });

    mongoose.connection.on('error', (e) => {
      // Important: log pour voir les vraies causes (auth, DNS, réseau, etc.)
      console.error('[mongo] connection error', e);
    });
  }
  return connectPromise;
}
