import axiosInstance from './axiosInstance';

interface TradeResponse {
  message?: string;
}

export const buyAsset = async (assetId: string, assetAmount: number): Promise<TradeResponse> => {
  const res = await axiosInstance.post<TradeResponse>(`/trade/buy/${assetId}`, { assetAmount });
  return res.data;
};

export const sellAsset = async (assetId: string, assetAmount: number): Promise<TradeResponse> => {
  const res = await axiosInstance.post<TradeResponse>(`/trade/sell/${assetId}`, { assetAmount });
  return res.data;
};

export const getQuote = async (assetId: string) => {
  const res = await axiosInstance.get(`/trade/quote/${assetId}`);
  return res.data;
};

export default { buyAsset, sellAsset, getQuote };
