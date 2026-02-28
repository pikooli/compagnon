import { contactService } from "@/app/service/contact";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const upsertContactSchema = z.object({
    contact: z.object({
        _id: z.string().describe("The id of the contact, don't change it"),
        name: z.string().describe("The name of the contact"),
        company: z.string().describe("The company of the contact"),
        role: z.string().describe("The role of the contact"),
        city: z.string().describe("The city of the contact"),
        email: z.string().describe("The email of the contact"),
        phone: z.string().describe("The phone of the contact"),
        tags: z.array(z.string()).describe("The tags of the contact"),
        notes: z.string().describe("The notes of the contact"),
    }),
});

const upsertContact = async ({ contact }: z.infer<typeof upsertContactSchema>) => {
    try {
        await contactService.upsertContact(contact);
    } catch (error) {
        console.error('Error upserting contact =========', error);
        return { error: 'Error upserting contact' };
    }
    return { result: 'Contact upserted successfully' };
}

const searchContactByQuerySchema = z.object({
    query: z.string().describe("The query to search for a contact"),
});

const searchContactByQuery = async (props: z.infer<typeof searchContactByQuerySchema>) => {
    try {
        const query = props.query;
        const contacts = await contactService.getContactsbyQuery(query);
        return { result: contacts };
    } catch (error) {
        console.error('Error searching for contact =========', error);
        return { error: 'Error searching for contact' };
    }
}

export const searchContactSchema = z.object({
    name: z.string().optional().describe("The name of the contact"),
    company: z.string().optional().describe("The company of the contact"),
    role: z.string().optional().describe("The role of the contact"),
    city: z.string().optional().describe("The city of the contact"),
    email: z.string().optional().describe("The email of the contact"),
    phone: z.string().optional().describe("The phone of the contact"),
    tags: z.array(z.string()).optional().describe("The tags of the contact"),
    notes: z.string().optional().describe("The notes of the contact"),
});


const searchContact = async (props: z.infer<typeof searchContactSchema>) => {
    try {
        const contacts = await contactService.getContacts(props);
        return { result: contacts };
    } catch (error) {
        console.error('Error searching for contact =========', error);
        return { error: 'Error searching for contact' };
    }
}

export const searchContactByQueryTool = tool(searchContactByQuery, {
    name: "searchContactByQuery",
    description: `Search for a contact, someone. use it when you need to search by meaning or that the other search fit the user request`,
    schema: searchContactByQuerySchema,
});

export const searchContactTool = tool(searchContact, {
    name: "searchContact",
    description: `Search for a contact, use when it need a search by specific fields`,
    schema: searchContactSchema,
});


export const upsertContactTool = tool(upsertContact, {
    name: "upsertContact",
    description: `Upsert a contact, use it when user provide a new contact information`,
    schema: upsertContactSchema,
});

export const tools = [searchContactByQueryTool, searchContactTool, upsertContactTool];