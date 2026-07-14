import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import { ExpoSqliteAdapter, RNNetworkStatus } from '@drakkar.software/anchor-adapter-react-native';

export const getAdapters = () => ({
  persistence: { adapter: new ExpoSqliteAdapter(SQLite, 'chrono-anchor-kv') },
  network: new RNNetworkStatus(NetInfo),
});
