import { searches } from "./config/searches.js";
import { openDatabase } from "./database/database.js";
import { ProductRepository } from "./database/ProductRepository.js";
import {
  fetchPrisjaktPage,
  searchPrisjakt,
} from "./prisjakt/PrisjaktClient.js";
import { parsePrisjaktProduct } from "./prisjakt/PrisjaktProductParser.js";

const database = openDatabase("data/pc-price-tracker.sqlite");
const productRepository = new ProductRepository(database);

try {
  for (const search of searches) {
    console.log(`\n${search.name} (${search.category})`);

    const products = await searchPrisjakt(search.url);
    const seenAt = new Date().toISOString();

    console.log(`Found ${products.length} products`);

    for (const product of products) {
      productRepository.upsert(
        {
          prisjaktId: product.id,
          category: search.category,
          name: product.name,
          url: product.url,
        },
        seenAt,
      );
    }

    console.table(products.slice(0, 20));
  }

  const product = productRepository.findFirst();

  if (product === undefined) {
    throw new Error("No persisted product available for product-page fetch");
  }

  console.log(`\nFetching product page: ${product.name}`);
  console.log(product.url);

  const productHtml = await fetchPrisjaktPage(product.url);
  const { offers, priceSek, ...details } = parsePrisjaktProduct(productHtml);
  const observedAt = new Date().toISOString();

  productRepository.upsertDetails(product.id, details);
  productRepository.upsertOffers(product.id, offers, observedAt);

  console.log("Persisted product:");
  console.table([product]);

  console.log("Persisted product details:");
  console.table([details]);

  console.log("Authoritative current price:");
  console.table([{ priceSek }]);

  console.log("Parsed product offers:");
  console.table(offers);
} finally {
  database.close();
}
