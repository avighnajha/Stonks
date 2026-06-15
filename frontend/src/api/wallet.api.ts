import axiosInstance from './axiosInstance';

export async function getWalletBalance(): Promise<number> {
  const res = await axiosInstance.get('/wallet/balance');
  // wallet service returns the wallet object
  const wallet = res.data || {};
  return Number(wallet.balance || 0);
}

export default { getWalletBalance };
