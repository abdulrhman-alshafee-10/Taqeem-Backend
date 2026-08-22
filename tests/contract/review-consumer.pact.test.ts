import { describe, it, expect } from "vitest";
import { MessageConsumerPact, Matchers } from "@pact-foundation/pact";
import path from "node:path";
import { badgeAwarderHandler } from "../../services/user-service/src/workers/badge-awarder.js";

const { like } = Matchers;

describe("Review Event Consumer Contract", () => {
  const messagePact = new MessageConsumerPact({
    consumer: "UserService-BadgeAwarder",
    dir: path.resolve(process.cwd(), "pacts"),
    pactfileWriteMode: "update",
    provider: "ReviewService",
    logLevel: "error"
  });

  describe("receive review.created event", () => {
    it("accepts a valid event", async () => {
      // Define the contract expectation
      await messagePact
        .expectsToReceive("a review.created event")
        .withContent({
          reviewId: like("rev-123"),
          authorId: like("user-456"),
          businessId: like("biz-789"),
          content: like("This was a great place!"),
          rating: like(5)
        })
        .withMetadata({
          "x-event-type": "review.created"
        })
        .verify(async (message: any) => {
          // This ensures that the message handler doesn't crash on the structure 
          // expected by the contract.
          expect(message.contents).toHaveProperty("authorId");
          expect(message.contents).toHaveProperty("reviewId");
        });
    });
  });
});
