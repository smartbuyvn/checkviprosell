export async function fetchWithTimeout(
  resource: RequestInfo | URL,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = 10000, ...rest } = options;
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(resource, {
      ...rest,
      signal: controller.signal
    });
    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms. Kiểm tra kết nối mạng hoặc API server.`);
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}
