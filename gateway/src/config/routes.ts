export interface RouteConfig {
  context: string | RegExp;
  target: string;
  auth: "required" | "optional" | "mixed";
  roles?: string[];
}

export const routeTable: RouteConfig[] = [
  {
    context: "/api/users",
    target: "http://user-service:4001",
    auth: "mixed",        // register/login = public; me = protected
  },
  {
    context: "/api/businesses",
    target: "http://business-service:4002",
    auth: "mixed",        // GET public, POST/PATCH require auth
  },
  {
    context: /^\/api\/owner\/businesses\/[^/]+\/analytics/,
    target: "http://analytics-service:4005",
    auth: "required",
    roles: ["OWNER", "ADMIN"],
  },
  {
    context: "/api/owner",
    target: "http://business-service:4002",
    auth: "required",
    roles: ["OWNER", "ADMIN"],
  },
  {
    context: "/api/reviews",
    target: "http://review-service:4003",
    auth: "mixed",
  },
  {
    context: "/api/media",
    target: "http://review-service:4003",
    auth: "required",
  },
  {
    context: "/api/search",
    target: "http://search-service:4004",
    auth: "optional",     // anonymous search allowed
  },
  {
    context: "/api/analytics",
    target: "http://analytics-service:4005",
    auth: "optional",
  },
  {
    context: "/api/agent",
    target: "http://agent-service:4006",
    auth: "optional",
  },
];
