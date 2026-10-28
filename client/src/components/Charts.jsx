import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '../context/ThemeContext';

// Single-series charts: one brand hue, recessive grid, tooltip on hover.
function useChartColors() {
  const dark = useTheme().theme === 'dark';
  return {
    mark: dark ? '#14b8a6' : '#0d9488',
    grid: dark ? '#1f2a44' : '#e2e8f0',
    ink: dark ? '#94a3b8' : '#64748b',
    tip: { background: dark ? '#111a2e' : '#fff', border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`, borderRadius: 8, color: dark ? '#e2e8f0' : '#0f172a' },
  };
}

export function HBar({ data, height = 240, label = 'Count' }) {
  const c = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} stroke={c.grid} />
        <XAxis type="number" allowDecimals={false} tick={{ fill: c.ink, fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={120} tick={{ fill: c.ink, fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: c.grid, opacity: 0.5 }} contentStyle={c.tip} formatter={(v) => [v, label]} />
        <Bar dataKey="value" fill={c.mark} radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendLine({ data, height = 240, label = 'Reports' }) {
  const c = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="date" tick={{ fill: c.ink, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(d) => d.slice(5)} minTickGap={24} />
        <YAxis allowDecimals={false} tick={{ fill: c.ink, fontSize: 12 }} axisLine={false} tickLine={false} width={32} />
        <Tooltip contentStyle={c.tip} formatter={(v) => [v, label]} />
        <Line type="monotone" dataKey="count" stroke={c.mark} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
