import { useCallback, useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

function isOnline(state: NetInfoState): boolean {
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(false);

  const applyState = useCallback((state: NetInfoState) => {
    setIsConnected(isOnline(state));
    setReady(true);
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(applyState);
    NetInfo.fetch().then(applyState).catch(() => {
      setReady(true);
    });

    return unsubscribe;
  }, [applyState]);

  const recheckConnection = useCallback(async () => {
    setChecking(true);
    try {
      const state = await NetInfo.fetch();
      applyState(state);
    } catch {
      setIsConnected(false);
      setReady(true);
    } finally {
      setChecking(false);
    }
  }, [applyState]);

  return {
    isConnected,
    isOffline: ready && !isConnected,
    ready,
    checking,
    recheckConnection,
  };
}
