import { searchContactSchema } from "@/app/lib/brain/tools/contact";
import { Contact, ContactDocument, ContactModel } from "@/app/lib/mongoose/schema/contact.schema";
import { qdrantTools } from "@/app/lib/qdrant";
import { z } from "zod";


const collectionName = 'contacts';

export const contactService = {
    getContacts: async (props: z.infer<typeof searchContactSchema>) => {
        const query: Record<string, any> = {};
        Object.entries(props).forEach(([key, value]) => {
            if (value) {
                query[key] = value;
            }
        });
        const contacts = await ContactModel.find(query);
        return contacts;
    },
    getContactsbyQuery: async (query: string) => {
        const contactsResult = await qdrantTools.searchSimilar({ collectionName, query });
        const contactsIds = contactsResult.map((contact) => contact.payload?._id);
        const contacts = await ContactModel.find({ _id: { $in: contactsIds as string[] } });
        return contacts;
    },
    upsertContact: async (newContact: Partial<ContactDocument>) => {
        const contact = await ContactModel.findByIdAndUpdate(newContact._id, newContact, { new: true });
        if (!contact) {
            throw new Error('Contact not found');
        }
        const tmpContact = { ...contact, ...newContact };
        const text = `
Contact: ${tmpContact.name}
Company: ${tmpContact.company}
Role: ${tmpContact.role}
City: ${tmpContact.city}
Tags: ${tmpContact.tags?.join(", ")}
Notes: ${tmpContact.notes}
`;
        const payload = {
            _id: contact._id,
            company: tmpContact.company,
            city: tmpContact.city,
            tags: tmpContact.tags,
            text,
            createdAt: tmpContact.createdAt,
        };
        const result = await qdrantTools.saveTextEntry({ collectionName, payload, id: contact._id.toString() });
        await ContactModel.findByIdAndUpdate(contact._id, tmpContact, { new: true });
        return result;
    },
    saveContact: async (contact: Omit<Contact, '_id'>) => {
        const createdContact = await ContactModel.create(contact);
        const text = `
Contact: ${contact.name}
Company: ${contact.company}
Role: ${contact.role}
City: ${contact.city}
Tags: ${contact.tags.join(", ")}
Notes: ${contact.notes}
`;
        const payload = {
            _id: createdContact._id,
            company: contact.company,
            city: contact.city,
            tags: contact.tags,
            text,
            createdAt: Date.now(),
        };
        await qdrantTools.saveTextEntry({ collectionName, payload, id: createdContact._id.toString() });
    },
};

