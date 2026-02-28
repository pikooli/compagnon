import { randomUUID } from 'crypto';
import { HydratedDocument, Schema, model, type InferSchemaType } from 'mongoose';

const ContactSchema = new Schema(
  {
    _id: {
      type: String,
      default: () => randomUUID(),
    },
    name: { type: String },
    company: { type: String },
    role: { type: String },
    city: { type: String },
    email: { type: String },
    phone: { type: String },
    tags: { type: [String] },
    notes: { type: String },
  },
  {
    collection: 'contacts',
    timestamps: true,
  }
);

export type Contact = InferSchemaType<typeof ContactSchema>;
export type ContactDocument = HydratedDocument<Contact>;
export const ContactModel = model(
  'Contact',
  ContactSchema
);
