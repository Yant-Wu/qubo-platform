// src/components/QubitProbChart.tsx — Q-bit 機率變化圖 (支援雙語)
import { memo, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { HistoryDataPoint } from '../types/job';

interface Props {
  history: HistoryDataPoint[];
  lang?: 'zh' | 'en'; // 💡 接收語言屬性
  visibleStart?: number;
  visibleEnd?: number;
}

function QubitProbChart({ history, lang = 'zh', visibleStart, visibleEnd }: Props) {
  const data = useMemo(
    () => history.filter((d) => Array.isArray(d.qubit_probs) && d.qubit_probs.length > 0),
    [history],
  );
  
  if (data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
        {lang === 'zh' ? '目前無 Q-bit 機率資料' : 'No Q-bit probability data available'}
      </div>
    );
  }

  const numQubits = (data[0].qubit_probs as number[]).length;
  const maxIter = data[data.length - 1]?.iteration ?? 1;
  const viewStart = visibleStart ?? 1;
  const viewEnd = visibleEnd ?? maxIter;

  return (
    <div className="w-full h-full overflow-y-auto px-4 pb-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {Array.from({ length: numQubits }).map((_, i) => {
          const seriesData = data.map(d => [d.iteration, (d.qubit_probs as number[])[i]]);

          const option = {
            animation: false,
            tooltip: { show: false },
            grid: { top: 15, right: 10, bottom: 25, left: 35 },
            xAxis: {
              type: 'value',
              name: 'Iter',
              nameLocation: 'middle',
              nameGap: 12,
              nameTextStyle: { color: '#9ca3af', fontSize: 10, fontWeight: 'bold' },
              axisLabel: { show: false },
              splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
              min: viewStart,
              max: viewEnd,
            },
            yAxis: {
              type: 'value',
              name: `Q[${i}]`,
              nameLocation: 'middle',
              nameGap: 22,
              nameTextStyle: { color: '#9ca3af', fontSize: 10, fontWeight: 'bold' },
              axisLabel: { color: '#9ca3af', fontSize: 9, margin: 4 },
              splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
              min: 0,
              max: 1,
            },
            series: [
              {
                type: 'line',
                data: seriesData,
                symbol: 'none',
                lineStyle: { color: '#ef4444', width: 1.5 },
              },
            ],
          };

          return (
            <div key={i} className="bg-gray-800/80 border border-gray-700/60 rounded-lg p-1 h-48 shadow-sm hover:border-gray-500 transition-colors">
              <ReactECharts
                option={option}
                style={{ height: '100%', width: '100%' }}
                opts={{ renderer: 'canvas' }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(QubitProbChart);
