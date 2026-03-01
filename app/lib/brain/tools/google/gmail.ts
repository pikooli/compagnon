import { getEmail as getEmailGmail, listEmails as listEmailsGmail, sendEmail as sendEmailGmail } from "@/app/lib/google-gmail";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const sendEmailSchema = z.object({
  to: z.string().describe("The email of the recipient"),
  subject: z.string().describe("The subject of the email"),
  body: z.string().describe("The body of the email"),
});

const sendEmail = async ({ to, subject, body }: z.infer<typeof sendEmailSchema>) => {
  try {
    const email = await sendEmailGmail({ to, subject, body });

    console.log('email', email);
  } catch (error) {
    console.error('error sending email', error);
    return { error };
  }

  return { result: 'Email sent successfully' };
}

const getEmailsSchema = z.object({
  maxResults: z.number().describe("The maximum number of emails to return, default 10"),
});

const getEmails = async ({ maxResults }: z.infer<typeof getEmailsSchema>) => {
  const list = await listEmailsGmail({
    maxResults: maxResults,
  });
  const messages = list ?? [];

  const fullEmails = await Promise.all(
    messages.map(async (msg) => {
      const email = await getEmailGmail(msg.id!);
      return email;
    })
  );
  console.log('fullEmails', JSON.stringify(fullEmails, null, 2));
  return { result: fullEmails };
}

export const getEmailsTool = tool(getEmails, {
  name: "getEmails",
  description: "Get the emails from the user's inbox",
  schema: getEmailsSchema,
});

export const sendEmailTool = tool(sendEmail, {
  name: "sendEmail",
  description: "Send an email to a contact",
  schema: sendEmailSchema,
});



export const tools = [sendEmailTool, getEmailsTool];