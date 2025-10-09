import axios, { AxiosRequestConfig } from "axios";
import { ENV } from "../config/env.js";

// Type for GraphQL  response
type GraphQLResponse<T> = {
  data: T;
  errors?: { message: string; field?: string }[];
  success: boolean;
  message?: string;
};

// Create axios instance
const api = axios.create({
  baseURL: ENV.SHOPIFY_ADMIN_API_URL, // Default base URL
});

// Request interceptor to add auth token and Shopify headers
api.interceptors.request.use(
  async (config) => {
    // Add Shopify-specific headers based on endpoint
    if (config.url?.includes(ENV.SHOPIFY_STOREFRONT_API_URL)) {
      config.headers["X-Shopify-Storefront-Access-Token"] =
        ENV.X_SHOPIFY_STOREFRONT_ACCESS_TOKEN;
      config.headers["X-Shopify-Access-Token"] = ENV.X_SHOPIFY_ACESS_TOKEN;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error("API Error:", error.response);
      return Promise.reject({
        ...error.response.data,
        status: error.response.status,
        success: false,
      });
    } else {
      console.error("Network/Unexpected Error:", error.message);
      return Promise.reject({
        success: false,
        message: "Something went wrong",
      });
    }
  }
);

// GraphQL API client
export const graphqlApi = {
  // Execute a GraphQL query
  query: async <T>(
    endpoint: string,
    query: string,
    variables?: Record<string, any>,
    headers?: Record<string, string>
  ): Promise<GraphQLResponse<T>> => {
    const config: AxiosRequestConfig = {
      method: "post",
      url: endpoint,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ENV.X_SHOPIFY_ACESS_TOKEN,
        ...headers,
      },
      data: JSON.stringify({ query, variables }),
    };

    try {
      const response = await api(config);
      return {
        data: response.data.data,
        errors: response.data.errors,
        success: !response.data.errors,
        message: response.data.errors?.[0]?.message || "Success",
      };
    } catch (error: any) {
      return {
        data: {} as T,
        success: false,
        message: error.message || "Failed to execute query",
      };
    }
  },

  // Execute a GraphQL mutation
  mutate: async <T>(
    endpoint: string,
    mutation: string,
    variables?: Record<string, any>,
    headers?: Record<string, string>
  ): Promise<GraphQLResponse<T>> => {
    return graphqlApi.query<T>(endpoint, mutation, variables, headers);
  },
};

export default graphqlApi;
