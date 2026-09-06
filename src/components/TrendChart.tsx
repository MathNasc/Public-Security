import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

export function TrendChart({ data }: { data: { month: string; count: number }[] }) {
  // Format the month from "YYYY-MM" to a short form, e.g. "Set", "Out"
  const formattedData = (data || []).map(d => {
    const [year, month] = d.month.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return {
      ...d,
      label: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
    };
  });

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={formattedData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
          <XAxis 
            dataKey="label" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            dy={10}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#94a3b8' }}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: '1px solid #1e293b', backgroundColor: '#020617', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }}
            labelStyle={{ color: '#94a3b8', fontSize: '12px' }}
            itemStyle={{ color: '#f8fafc', fontWeight: 500 }}
          />
          <Area 
            type="monotone" 
            dataKey="count" 
            stroke="#f59e0b" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorCount)" 
            name="Ocorrências"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
