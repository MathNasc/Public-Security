import React, { useState } from 'react';
import { Bell, BellRing, Loader2 } from 'lucide-react';

export function WatchRegionButton({ name, lat, lon, radius, score }: any) {
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleWatch = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'guest-user', // MVP placeholder
          name,
          lat,
          lon,
          radius,
          lastScore: score
        })
      });
      if (res.ok) setSubscribed(true);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  if (subscribed) {
    return (
      <button disabled className="flex items-center gap-2 bg-slate-800 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium border border-slate-700">
        <BellRing className="w-4 h-4 text-amber-500" /> Acompanhando
      </button>
    );
  }

  return (
    <button 
      onClick={handleWatch}
      disabled={loading}
      className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-amber-500/20"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
      Acompanhar Região
    </button>
  );
}
