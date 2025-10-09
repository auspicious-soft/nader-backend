import graphqlApi from "./graphqlApi.js";
import { CollectionListResponse } from "./type.js";

export const fetchCollectionsList = async (
  first: number = 5,
  after: string | null = null,
  handle: string | null = null
) => {
  const query = `
    query CustomCollectionList($first: Int!, $after: String, $handle: String) {
      collections(first: $first, after: $after, query: $handle) {
        nodes {
          id
          handle
          title      
          updatedAt
          descriptionHtml
          image {            
            originalSrc            
          }      
            products(first: 1) { # Check if the collection has at least one product
             nodes {
               id
             }
           }
          }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  `;
 
  const variables = handle ? { first, after, handle } : { first, after };
 
  return graphqlApi.query<CollectionListResponse>(
    "https://bokittaofficial.myshopify.com/admin/api/2025-04/graphql.json",
    query,
    variables
  );
};