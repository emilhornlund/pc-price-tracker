export interface PrisjaktProductSummary {
  id: string;
  name: string;
  priceSek: number;
  url: string;
}

export interface PrisjaktProductDetails {
  brand: string;
  description: string;
  imageUrl: string;
  priceSek: number;
}
