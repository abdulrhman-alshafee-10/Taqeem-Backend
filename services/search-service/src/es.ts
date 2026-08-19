import { Client } from "@elastic/elasticsearch";

export const client = new Client({
  node: process.env.ES_NODE || "http://elasticsearch:9200",
  maxRetries: 3,
  requestTimeout: 5000,
});
