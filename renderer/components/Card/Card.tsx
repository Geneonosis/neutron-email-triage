import type { ReactNode } from 'react';
import { Activity, Clock3, HeartPulse, ScanLine, Settings2 } from 'lucide-react';
import type { ChipState } from '../StatusChip/StatusChip.js';
import { StatusChip } from '../StatusChip/StatusChip.js';

interface CardProps {
  title: string;
  state: ChipState;
  className?: string;
  children: ReactNode;
}

export function Card({ title, state, className = '', children }: CardProps) {
  const TitleIcon = title === 'Health' ? HeartPulse
    : title === 'Config' ? Settings2
      : title === 'History' ? Clock3
        : title === 'Run / Scan' ? ScanLine : Activity;

  return (
    <section className={`card ${className}`}>
      <div className="card-head">
        <h2 className="card-title"><TitleIcon aria-hidden="true" size={18} />{title}</h2>
        <StatusChip state={state} />
      </div>
      {children}
    </section>
  );
}
