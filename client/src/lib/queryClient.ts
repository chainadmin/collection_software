import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let message = text;
    try {
      const payload = JSON.parse(text);
      message = payload.error || payload.message || text;
    } catch {
      // Keep a non-JSON gateway/proxy response as-is.
    }
    throw new Error(message || `Request failed (${res.status})`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: { headers?: Record<string, string>; timeoutMs?: number },
): Promise<Response> {
  const controller = options?.timeoutMs ? new AbortController() : undefined;
  const timeout = controller
    ? window.setTimeout(() => controller.abort(), options!.timeoutMs)
    : undefined;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { ...(data ? { "Content-Type": "application/json" } : {}), ...(options?.headers ?? {}) },
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
      signal: controller?.signal,
    });
  } catch (error) {
    if (controller?.signal.aborted) {
      throw new Error("The payment service did not respond in time. The form is still open; verify the gateway before trying again.");
    }
    throw error;
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
