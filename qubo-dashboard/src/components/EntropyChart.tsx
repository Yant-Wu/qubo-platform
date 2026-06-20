// src/components/EntropyChart.tsx — AEQTS Q-bit Entropy 收斂圖
// 對應 test.py 的 entropy_history.json
// Entropy 接近 1 = Q-bit 最不確定（量子態），接近 0 = 完全收斂（古典態）
import ReactECharts from 'echarts-for-react';
import type { HistoryDataPoint } from '../types/job';

interface Props {
  history: HistoryDataPoint[];
  compact?: boolean;
}

export default function EntropyChart({ history, compact = false }: Props) {
  const data = history.filter((d) => d.entropy != null);
  if (data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
        無 Entropy 資料
      </div>
    );
  }

  const option = {
    backgroundColor: 'transparent',
    grid: compact
      ? { top: 6, right: 6, bottom: 6, left: 6 }
      : { top: 24, right: 16, bottom: 36, left: 52 },
    xAxis: {
      type: 'value',
      name: compact ? '' : 'Iteration',
      nameTextStyle: { color: '#6b7280', fontSize: 10 },
      axisLine: { lineStyle: { color: '#374151' } },
      axisTick: { show: !compact, lineStyle: { color: '#374151' } },
      axisLabel: { show: !compact, color: '#6b7280', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1f2937' } },
      min: 0,
      max: data[data.length - 1]?.iteration ?? 1,
    },
    yAxis: {
      type: 'value',
      name: compact ? '' : 'Entropy',
      nameTextStyle: { color: '#6b7280', fontSize: 10 },
      axisLine: { lineStyle: { color: '#374151' } },
      axisTick: { show: !compact, lineStyle: { color: '#374151' } },
      axisLabel: { show: !compact, color: '#6b7280', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1f2937' } },
      min: 0,
      max: 1,
    },
    tooltip: compact ? { show: false } : {
      trigger: 'axis',
      backgroundColor: '#1f2937',
      borderColor: '#374151',
      textStyle: { color: '#e5e7eb', fontSize: 11 },
      formatter: (params: { value: number[] }[]) => {
        const p = params[0];
        return `Iter ${p.value[0]}<br/>Entropy: <b>${p.value[1].toFixed(4)}</b>`;
      },
    },
    series: [
      {
        type: 'line',
        name: 'Q-bit Entropy',
        data: data.map((d) => [d.iteration, d.entropy]),
        symbol: 'none',
        lineStyle: { color: '#a78bfa', width: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(167,139,250,0.25)' },
              { offset: 1, color: 'rgba(167,139,250,0.00)' },
            ],
          },
        },
        smooth: 0.3,
        markLine: {
          silent: true,
          symbol: 'none',
          data: [{ yAxis: 0, label: { formatter: '完全收斂', color: '#4b5563' }, lineStyle: { color: '#374151', type: 'dashed' } }],
        },
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ width: '100%', height: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  );
}
