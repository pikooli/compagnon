import { HydratedDocument, Schema, model, type InferSchemaType } from 'mongoose';

const MemorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    memory: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
  },
  {
    collection: 'memories',
    timestamps: true,
    _id: true,
  }
);

export type Memory = InferSchemaType<typeof MemorySchema>;
export type MemoryDocument = HydratedDocument<Memory>;
export const MemoryModel = model('Memory', MemorySchema);
