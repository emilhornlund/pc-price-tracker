export interface PrisjaktProductSummary {
  id: string;
  name: string;
  priceSek: number;
  url: string;
}

export interface PrisjaktProductOffer {
  shopId: number;
  shopName: string;
  shopOfferId: string;
  priceSek: number;
}

export interface PrisjaktProductDetails {
  brand: string;
  description: string;
  imageUrl: string;
  priceSek: number;
  offers: PrisjaktProductOffer[];
}
