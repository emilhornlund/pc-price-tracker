import { searches } from "./config/searches.js";
import { searchPrisjakt } from "./prisjakt/PrisjaktClient.js";

for (const search of searches) {
  console.log(`\n${search.name}`);

  const products = await searchPrisjakt(search.url);

  console.log(`Found ${products.length} unique products`);

  console.table(products.slice(0, 20));
}
