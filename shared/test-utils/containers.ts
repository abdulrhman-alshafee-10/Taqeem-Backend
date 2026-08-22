import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { MongoDBContainer } from "@testcontainers/mongodb";
import { GenericContainer } from "testcontainers";

export async function startPostgres() {
  const container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("taqeem_test")
    .withUsername("taqeem")
    .withPassword("taqeem_pw")
    .start();

  return {
    container,
    url: container.getConnectionUri(),
  };
}

export async function startMongo() {
  const container = await new MongoDBContainer("mongo:7").start();
  return {
    container,
    url: container.getConnectionString(),
  };
}

export async function startRedis() {
  const container = await new GenericContainer("redis:7-alpine")
    .withExposedPorts(6379)
    .start();
  return {
    container,
    url: `redis://localhost:${container.getMappedPort(6379)}`,
  };
}
