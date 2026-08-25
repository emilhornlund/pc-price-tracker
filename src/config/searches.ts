export type ComponentCategory =
  | "cpu"
  | "cpu-cooler"
  | "motherboard"
  | "memory"
  | "storage"
  | "gpu"
  | "case"
  | "psu";

export interface SearchDefinition {
  id: string;
  name: string;
  category: ComponentCategory;
  url: string;
}

export const searches: SearchDefinition[] = [
  {
    id: "memory-64gb-ddr5-6000",
    name: "64 GB DDR5-6000",
    category: "memory",
    url: "https://www.prisjakt.nu/c/ram-minne?1170=39865&1171=37753&r_1181=2-8&r_95336=64-64&r_lowestPrice=1000-15000&sort=price",
  },
  {
    id: "memory-32gb-ddr5-6000",
    name: "32 GB DDR5-6000",
    category: "memory",
    url: "https://www.prisjakt.nu/c/ram-minne?1170=39865&1171=37753&r_1181=2-8&r_95336=32-32&r_lowestPrice=1000-8000&sort=price",
  },
];
