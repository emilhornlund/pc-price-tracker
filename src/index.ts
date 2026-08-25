import { searches } from "./config/searches.js";
import { searchPrisjakt } from "./prisjakt/PrisjaktClient.js";

for (const search of searches) {
  console.log(`\n${search.name} (${search.category})`);

  const products = await searchPrisjakt(search.url);

  console.log(`Found ${products.length} products`);

  console.table(products.slice(0, 20));
}
