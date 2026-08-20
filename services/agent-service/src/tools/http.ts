import axios, { AxiosInstance } from "axios";

export function serviceClient(baseURL: string, userId?: string | null, role?: string | null): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: 5000,
    headers: {
      "content-type": "application/json",
      ...(userId ? { "x-user-id": userId } : {}),
      ...(role   ? { "x-user-role": role } : {}),
      "x-source": "agent-service",
    },
  });
}
