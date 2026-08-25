import { searches } from "./config/searches.js";
import { openDatabase } from "./database/database.js";
import { ProductRepository } from "./database/ProductRepository.js";
import { searchPrisjakt } from "./prisjakt/PrisjaktClient.js";

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
          name: product.name,
          url: product.url,
        },
        seenAt,
      );
    }

    console.table(products.slice(0, 20));
  }
} finally {
  database.close();
}
