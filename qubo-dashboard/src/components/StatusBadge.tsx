// src/components/StatusBadge.tsx

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  completed: { label: '已完成', bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  running:   { label: '執行中', bg: 'bg-sky-500/15',     text: 'text-sky-400',     dot: 'bg-sky-400' },
  pending:   { label: '等待中', bg: 'bg-amber-500/15',   text: 'text-amber-400',   dot: 'bg-amber-400' },
  failed:    { label: '失敗',   bg: 'bg-rose-500/15',    text: 'text-rose-400',    dot: 'bg-rose-400' },
};

const fallback = { label: '未知', bg: 'bg-gray-500/15', text: 'text-gray-400', dot: 'bg-gray-400' };

interface Props {
  status: string;
  dotOnly?: boolean;
}

export default function StatusBadge({ status, dotOnly = false }: Props) {
  const cfg = statusConfig[status] ?? fallback;

  if (dotOnly) {
    return (
      <span
        title={cfg.label}
        className={`inline-block w-2 h-2 rounded-full ${cfg.dot} ${status === 'running' ? 'animate-pulse' : ''}`}
      />
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === 'running' ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  );
}
