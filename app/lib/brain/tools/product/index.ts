import { productService } from "@/app/service/product";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const upsertProductSchema = z.object({
    product: z.object({
        _id: z.string().describe("The id of the product, don't change it"),
        name: z.string().describe("The name of the product"),
        description: z.string().describe("The description of the product"),
        price: z.number().describe("The price of the product"),
        tags: z.array(z.string()).describe("The tags of the product"),
    }),
});

const upsertProduct = async ({ product }: z.infer<typeof upsertProductSchema>) => {
    try {
        await productService.upsertProduct(product);
    } catch (error) {
        return { error: 'Error upserting product' };
    }
    return { result: 'Product upserted successfully' };
}

const searchProductSchema = z.object({
    query: z.string().describe("The query to search for a product"),
});

const searchProduct = async ({ query }: z.infer<typeof searchProductSchema>) => {
    try {
        console.log('query =========', query);
        const products = await productService.getProducts(query);
        console.log('products =========', products);
            return { result: products };
    } catch (error) {
        console.error('Error searching for product =========', error);
        return { error: 'Error searching for product' };
    }
}

export const searchProductTool = tool(searchProduct, {
    name: "searchProduct",
    description: `Search for a information about a product of the company`,
    schema: searchProductSchema,
});


export const upsertProductTool = tool(upsertProduct, {
    name: "upsertProduct",
    description: `Upsert a product, use it when user provide a update on product information`,
    schema: upsertProductSchema,
});

export const tools = [searchProductTool, upsertProductTool];