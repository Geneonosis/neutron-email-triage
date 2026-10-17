import { AlertCircle, CheckCircle2, Circle, LoaderCircle } from 'lucide-react';

export type ChipState = 'idle' | 'loading' | 'ok' | 'err';

export function StatusChip({ state }: { state: ChipState }) {
  const label = state === 'idle' ? 'Idle'
    : state === 'loading' ? 'Loading...'
      : state === 'ok' ? 'Loaded' : 'Error';
  const Icon = state === 'idle' ? Circle
    : state === 'loading' ? LoaderCircle
      : state === 'ok' ? CheckCircle2 : AlertCircle;

  return (
    <span className={`chip chip-${state}`}>
      <Icon aria-hidden="true" className={state === 'loading' ? 'icon-spin' : undefined} size={14} />
      {label}
    </span>
  );
}
