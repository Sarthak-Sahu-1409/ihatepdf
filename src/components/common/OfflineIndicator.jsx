import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 bg-yellow-100 border-2 border-yellow-400 text-yellow-800 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
      <WifiOff className="w-5 h-5" />
      <span className="font-semibold">Offline Mode - All tools still work!</span>
    </div>
  );
}