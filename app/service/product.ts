import { Product, ProductModel } from "@/app/lib/mongoose/schema/product.schema";
import { qdrantTools } from "@/app/lib/qdrant";

const collectionName = 'products';

export const productService = {
    getProducts: async (query: string) => {
        const productsResult = await qdrantTools.searchSimilar({ collectionName, query });
        const productsIds = productsResult.map((product) => product.payload?._id as string);
        const products = await ProductModel.find({ _id: { $in: productsIds } });
        return products;
    },
    upsertProduct: async (newProduct: Partial<Product & { _id: string }>) => {
        const product = await ProductModel.findByIdAndUpdate(newProduct._id, newProduct, { new: true });
        if (!product) {
            throw new Error('Contact not found');
        }
        const tmpProduct = { ...product, ...newProduct };
        const text = `
Product: ${tmpProduct.name}
Description: ${tmpProduct.description}
Price: ${tmpProduct.price}
Tags: ${tmpProduct.tags?.join(", ")}
`;
        const payload = {
            _id: product._id,
            description: tmpProduct.description,
            price: tmpProduct.price,
            tags: tmpProduct.tags,
            text,
            createdAt: tmpProduct.createdAt,
        };
        const result = await qdrantTools.saveTextEntry({ collectionName, payload, id: product._id.toString() });
        await ProductModel.findByIdAndUpdate(product._id, tmpProduct, { new: true });
        return result;
    },
    saveProduct: async (product: Omit<Product, '_id'>) => {
        const createdProduct = await ProductModel.create(product);
        const text = `
Product: ${product.name}
Description: ${product.description}
Price: ${product.price}
Tags: ${product.tags.join(", ")}
`;
        const payload = {
            _id: createdProduct._id,
        description: product.description,
            price: product.price,
            tags: product.tags,
            text,
            createdAt: createdProduct.createdAt,
        };
        await qdrantTools.saveTextEntry({ collectionName, payload, id: createdProduct._id.toString() });
    },
};