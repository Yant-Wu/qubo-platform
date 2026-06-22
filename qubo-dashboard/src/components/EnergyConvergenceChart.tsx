// src/components/EnergyConvergenceChart.tsx — 能量收斂折線圖 (支援雙語)
import { memo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { HistoryDataPoint } from '../types/job';

interface Props {
  history: HistoryDataPoint[];
  compact?: boolean;
  lang?: 'zh' | 'en'; // 💡 接收語言屬性
  visibleStart?: number;
  visibleEnd?: number;
}

function EnergyConvergenceChart({ history, compact = false, lang = 'zh', visibleStart, visibleEnd }: Props) {
  if (history.length === 0) return null;

  const quboHistory = history.filter((d) => d.qubo_energy != null);
  const hasQE = quboHistory.length > 0;
  // Keep the stored QUBO energy untouched, but plot its change from the first
  // recorded iteration. This makes small improvements visible despite a large
  // negative raw-energy offset.
  const initialQuboEnergy = quboHistory[0]?.qubo_energy ?? 0;
  const baselineIteration = quboHistory[0]?.iteration ?? 1;
  const rawBaselineLabel = initialQuboEnergy.toLocaleString(undefined, { maximumFractionDigits: 4 });
  const relativeQuboName = lang === 'zh' ? '相對 QUBO Energy' : 'Relative QUBO Energy';
  const lastIteration = history[history.length - 1]?.iteration ?? 1;
  // Keep Iteration in a fixed-width column beside the energy axis.
  const axisLabelColumnWidth = 72;
  const chartRightGutter = hasQE ? 70 : 20;
  const axisTickFontSize = 14;
  const axisTitleFontSize = 15;

  // 💡 根據語言設定 Tooltip 文字
  const tooltipText = {
    zh: {
      bestDesc: '歷史最佳解的總價值<br/>只增不減，最右端即為最終答案',
      quboDesc: '以第一代 QUBO energy 為 0 的相對變化<br/>負值代表找到更低能量；raw energy 保留在提示框'
    },
    en: {
      bestDesc: 'Total value of the best historical solution<br/>Only increases, rightmost is the final answer',
      quboDesc: 'Change from the first-iteration QUBO energy (set to 0)<br/>Negative values mean lower energy; raw energy remains in the tooltip'
    }
  };

  const option = {
    backgroundColor: 'transparent',
    grid: compact
      ? { top: 6, right: 6, bottom: 6, left: 6 }
      : { top: 66, right: chartRightGutter, bottom: 60, left: 70 },
    legend: compact ? undefined : hasQE ? {
      top: 0,
      left: 'center',
      textStyle: { color: '#e5e7eb', fontSize: 13 },
      itemWidth: 16,
      itemHeight: 10,
      tooltip: {
        show: true,
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        textStyle: { color: '#e5e7eb', fontSize: 13 },
        formatter: (params: { name: string }) => {
          if (params.name === 'Best Objective') return tooltipText[lang].bestDesc;
          if (params.name === relativeQuboName) return tooltipText[lang].quboDesc;
          return params.name;
        },
      },
    } : undefined,
    graphic: compact ? undefined : [
      ...(hasQE ? [{
        type: 'text' as const,
        top: 25,
        left: 'center',
        silent: true,
        style: {
          text: lang === 'zh'
            ? `相對於 Iteration ${baselineIteration} · 原始 QUBO Energy 基準值：${rawBaselineLabel}`
            : `Relative to Iteration ${baselineIteration} · Raw QUBO Energy baseline: ${rawBaselineLabel}`,
          fill: '#94a3b8',
          font: '12px sans-serif',
          textAlign: 'center',
        },
      }] : []),
      {
        type: 'text',
        right: chartRightGutter,
        bottom: 3,
        silent: true,
        style: {
          text: 'Iteration',
          width: axisLabelColumnWidth,
          fill: '#e5e7eb',
          font: `${axisTitleFontSize}px sans-serif`,
          textAlign: 'left',
          textVerticalAlign: 'top',
        },
      },
    ],
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#374151' } },
      axisTick: { show: !compact, lineStyle: { color: '#374151' } },
      axisLabel: { show: !compact, color: '#e5e7eb', fontSize: axisTickFontSize, margin: 9 },
      splitLine: { lineStyle: { color: '#1f2937' } },
      min: visibleStart ?? 1,
      max: visibleEnd ?? lastIteration,
    },
    yAxis: [
      {
        type: 'value',
        name: compact ? '' : 'Best Value',
        nameTextStyle: { color: '#e5e7eb', fontSize: axisTitleFontSize, align: 'left' },
        axisLine: { lineStyle: { color: '#374151' } },
        axisTick: { show: !compact, lineStyle: { color: '#374151' } },
        axisLabel: { show: !compact, color: '#e5e7eb', fontSize: axisTickFontSize },
        splitLine: { lineStyle: { color: '#1f2937' } },
      },
      hasQE ? {
        type: 'value',
        name: compact ? '' : relativeQuboName,
        // Place the title outside the right Y axis.
        nameTextStyle: { color: '#e5e7eb', fontSize: axisTitleFontSize, align: 'left' },
        axisLine: { lineStyle: { color: '#374151' } },
        axisTick: { show: !compact, lineStyle: { color: '#374151' } },
        axisLabel: { show: !compact, color: '#e5e7eb', fontSize: axisTickFontSize },
        splitLine: { show: false },
      } : undefined,
    ].filter(Boolean),
    tooltip: compact ? { show: false } : {
      trigger: 'axis',
      axisPointer: { type: 'line', snap: true, lineStyle: { color: '#6b7280', type: 'dashed', width: 1 } },
      backgroundColor: '#1f2937',
      borderColor: '#374151',
      textStyle: { color: '#e5e7eb', fontSize: 14 },
      formatter: (params: { seriesName: string; value: number[] }[]) =>
        params.map((p) => {
          if (p.seriesName === relativeQuboName) {
            const rawEnergy = p.value[1] + initialQuboEnergy;
            return `${p.seriesName}: <b>${p.value[1].toFixed(4)}</b><br/>Raw QUBO Energy: <b>${rawEnergy.toFixed(4)}</b>`;
          }
          return `${p.seriesName}: <b>${p.value[1].toFixed(4)}</b>`;
        }).join('<br/>') +
        `<br/><span style="color:#6b7280">Iter ${params[0]?.value[0]}</span>`,
    },
    series: [
      {
        name: 'Best Objective', type: 'line', yAxisIndex: 0,
        data: history.map((d) => [d.iteration, d.value]),
        symbol: 'circle', symbolSize: 5, showSymbol: false,
        itemStyle: { color: '#22c55e' },
        lineStyle: { color: '#22c55e', width: 2 },
        areaStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(34,197,94,0.25)' }, { offset: 1, color: 'rgba(34,197,94,0.00)' }] }
        },
        smooth: 0.3,
      },
      ...(hasQE ? [{
        name: relativeQuboName, type: 'line', yAxisIndex: 1,
        data: quboHistory.map((d) => [d.iteration, (d.qubo_energy as number) - initialQuboEnergy]),
        symbol: 'circle', symbolSize: 5, showSymbol: false,
        itemStyle: { color: '#3b82f6' },
        lineStyle: { color: '#3b82f6', width: 1.5, type: 'dashed' },
        smooth: 0.3,
      }] : []),
    ],
  };

  // Recreate the option on updates.  ECharts otherwise merges `graphic`
  // entries by array index, which can leave an old Iteration label on screen.
  return <ReactECharts option={option} notMerge style={{ width: '100%', height: '100%' }} opts={{ renderer: 'canvas' }} />;
}

export default memo(EnergyConvergenceChart);
