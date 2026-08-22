import { describe, it, expect, vi, beforeEach } from "vitest";
import { badgeAwarderHandler } from "../badge-awarder.js";
import { prismaMock } from "../../../../../shared/test-utils/prismaMock.js";
import { publishEvent } from "@taqeem/shared/events/publisher.js";
import axios from "axios";

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn().mockImplementation(() => prismaMock)
}));

vi.mock("axios");

describe("badgeAwarderHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ignores unknown events", async () => {
    await badgeAwarderHandler({}, { "x-event-type": "unknown.event" });
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("awards badge if criteria is met and user doesnt have it", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { mediaCount: 60 } });
    prismaMock.userBadge.findUnique.mockResolvedValueOnce(null);

    await badgeAwarderHandler({ authorId: "user-1" }, { "x-event-type": "review.created" });

    expect(prismaMock.userBadge.create).toHaveBeenCalledWith({
      data: { userId: "user-1", badgeKey: "photo_hunter" }
    });
    expect(publishEvent).toHaveBeenCalledWith("user.badge_awarded", { userId: "user-1", badgeKey: "photo_hunter" });
  });

  it("does not award badge if already possessed", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { mediaCount: 60 } });
    prismaMock.userBadge.findUnique.mockResolvedValueOnce({ id: 1 } as any);

    await badgeAwarderHandler({ authorId: "user-1" }, { "x-event-type": "review.created" });

    expect(prismaMock.userBadge.create).not.toHaveBeenCalled();
    expect(publishEvent).not.toHaveBeenCalled();
  });

  it("does not award badge if criteria not met", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { mediaCount: 10 } }); // < 50
    prismaMock.userBadge.findUnique.mockResolvedValueOnce(null);

    await badgeAwarderHandler({ authorId: "user-1" }, { "x-event-type": "review.created" });

    expect(prismaMock.userBadge.create).not.toHaveBeenCalled();
    expect(publishEvent).not.toHaveBeenCalled();
  });
});
