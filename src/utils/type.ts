export interface CollectionListResponse {
  collections: Collections;
}
 
export interface Collections {
  nodes: Node[];
}
 
export interface Node {
  id: string;
  handle: string;
  title: string;
  updatedAt: string;
  descriptionHtml: string;
  image?: Image;
  products: Products;
}
 
export interface Image {
  originalSrc: string;
}
 
export interface Products {
  nodes: ProductNode[];
}
 
export interface ProductNode {
  id: string;
}
 
export interface Extensions {
  cost: Cost;
}
 
export interface Cost {
  requestedQueryCost: number;
  actualQueryCost: number;
  throttleStatus: ThrottleStatus;
}
 
export interface ThrottleStatus {
  maximumAvailable: number;
  currentlyAvailable: number;
  restoreRate: number;
}
 