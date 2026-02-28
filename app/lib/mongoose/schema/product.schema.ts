import { randomUUID } from 'crypto';
import { HydratedDocument, Schema, model, type InferSchemaType } from 'mongoose';

const ProductSchema = new Schema(
  {
    _id: {
      type: String,
      default: () => randomUUID(),
    },

    name: { type: String },
    description: { type: String },
    price: { type: Number },
    tags: { type: [String] },
  },
  {
    collection: 'products',
    timestamps: true,
  }
);

export type Product = InferSchemaType<typeof ProductSchema>;
export type ProductDocument = HydratedDocument<Product>;
export const ProductModel = model(
  'Product',
  ProductSchema
);
