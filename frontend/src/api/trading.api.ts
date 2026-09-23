import axiosInstance from "./axiosInstance";

export interface TradeResponse {
  message?: string;
  status: "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED";
  filledQuantity?: string;
  remainingQuantity?: string;
  orderId: string;
}
export type TradePayload = {
  assetAmount: string | number;
  price: string | number;
  type: "MARKET" | "LIMIT";
};

// Persist uncertain commands across refreshes; an identical retry must reuse its key.
export async function command<T>(
  method: "post" | "delete",
  url: string,
  payload: unknown = {},
): Promise<T> {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const slot = `stonks:pending:${user.id}:${method}:${url}:${JSON.stringify(payload)}`;
  const key = localStorage.getItem(slot) || crypto.randomUUID();
  localStorage.setItem(slot, key);
  try {
    const response = await axiosInstance.request<T>({
      method,
      url,
      data: payload,
      headers: { "Idempotency-Key": key },
    });
    localStorage.removeItem(slot);
    window.dispatchEvent(new Event("portfolio:updated"));
    return response.data;
  } catch (error: any) {
    const status = error.response?.status;
    if (status && status >= 400 && status < 500 && status !== 408) {
      localStorage.removeItem(slot);
      error.message = String(error.response?.data?.message || error.message);
    }
    if (!status || status >= 500 || status === 408)
      error.message =
        "Outcome uncertain. Retry the unchanged order safely, or check My Orders.";
    throw error;
  }
}
export const buyAsset = (id: string, payload: TradePayload) =>
  command<TradeResponse>("post", `/trade/buy/${id}`, payload);
export const sellAsset = (id: string, payload: TradePayload) =>
  command<TradeResponse>("post", `/trade/sell/${id}`, payload);
export const cancelOrder = (id: string) =>
  command<TradeResponse>("delete", `/trade/order/${id}`);
export const getQuote = async (id: string) =>
  (await axiosInstance.get(`/trade/quote/${id}`)).data;
export default { buyAsset, sellAsset, getQuote, cancelOrder };
