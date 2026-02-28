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

const searchContactSchema = z.object({
    query: z.string().describe("The query to search for a contact"),
});

const searchContact = async (props: z.infer<typeof searchContactSchema>) => {
    try {
        console.log('props =========', props);
        const query = props.query;
        console.log('searchContact =========', query);
        const contacts = await contactService.getContacts(query);
        console.log('contacts =========', contacts);
        return { result: contacts };
    } catch (error) {
        console.error('Error searching for contact =========', error);
        return { error: 'Error searching for contact' };
    }
}

export const searchContactTool = tool(searchContact, {
    name: "searchContact",
    description: `Search for a contact, someone. user it when user ask for someone information or to find someone`,
    schema: searchContactSchema,
});


export const upsertContactTool = tool(upsertContact, {
    name: "upsertContact",
    description: `Upsert a contact, use it when user provide a new contact information`,
    schema: upsertContactSchema,
});

export const tools = [searchContactTool, upsertContactTool];