import { LocalStorageAdapter, WebNetworkStatus } from '@drakkar.software/anchor-adapter-web';

export const getAdapters = () => {
  if (typeof window === 'undefined') {
    // SSR — no persistence or network
    return { persistence: undefined, network: undefined };
  }
  return {
    persistence: { adapter: new LocalStorageAdapter() },
    network: new WebNetworkStatus(),
  };
};
