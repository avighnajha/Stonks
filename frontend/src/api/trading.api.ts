import axiosInstance from './axiosInstance';

interface TradeResponse {
  message?: string;
}

type TradePayload = { assetAmount: number; price: number; type: 'MARKET' | 'LIMIT' };

export const buyAsset = async (assetId: string, payload: TradePayload): Promise<TradeResponse> => {
  const res = await axiosInstance.post<TradeResponse>(`/trade/buy/${assetId}`, payload);
  return res.data;
};

export const sellAsset = async (assetId: string, payload: TradePayload): Promise<TradeResponse> => {
  const res = await axiosInstance.post<TradeResponse>(`/trade/sell/${assetId}`, payload);
  return res.data;
};

export const getQuote = async (assetId: string) => {
  const res = await axiosInstance.get(`/trade/quote/${assetId}`);
  return res.data;
};

export default { buyAsset, sellAsset, getQuote };
