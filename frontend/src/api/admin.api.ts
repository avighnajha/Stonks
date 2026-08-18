import axiosInstance from './axiosInstance';

export const getAdminMarketStats = async () => {
  const response = await axiosInstance.get('/admin/market-stats');
  return response.data;
};

export const getAdminLeaderboard = async () => {
  const response = await axiosInstance.get('/admin/leaderboard');
  return response.data;
};

export const getAdminOrderBook = async (assetId: string) => {
  const response = await axiosInstance.get(`/admin/order-book/${assetId}`);
  return response.data;
};

export const getAdminAllTrades = async () => {
  const response = await axiosInstance.get('/admin/all-trades');
  return response.data;
};

export const getAdminPriceHistory = async (assetId: string, timeframe?: string) => {
  const url = `/admin/price-history/${assetId}${timeframe ? `?timeframe=${timeframe}` : ''}`;
  const response = await axiosInstance.get(url);
  return response.data;
};

export const getApprovedAssets = async () => {
  const response = await axiosInstance.get('/assets/approved');
  return response.data;
};
