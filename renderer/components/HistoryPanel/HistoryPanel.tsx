import type { HistoryEntry } from '../../../types.js';
import { RefreshCw } from 'lucide-react';
import { Card } from '../Card/Card.js';
import type { ChipState } from '../StatusChip/StatusChip.js';

interface HistoryPanelProps {
  state: ChipState;
  busy: boolean;
  limit: number;
  entries: HistoryEntry[];
  onLimitChange: (limit: number) => void;
  onRefresh: () => void;
}

export function HistoryPanel({
  state,
  busy,
  limit,
  entries,
  onLimitChange,
  onRefresh,
}: HistoryPanelProps) {
  return (
    <Card title="History" state={state} className="full">
      <div className="toolbar">
        <div className="row" style={{ margin: 0 }}>
          <label>Show last <input type="number" min="1" value={limit}
            onChange={(event) => onLimitChange(Number(event.target.value))} /></label>
        </div>
        <button className="ghost" onClick={onRefresh} disabled={busy}>
          <RefreshCw aria-hidden="true" size={14} /> Refresh history
        </button>
      </div>
      <div className="history-table">
        <table>
          <thead><tr><th>ts</th><th>choice</th><th>P(trash)</th><th>subject</th><th>action</th></tr></thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={`${entry.messageId ?? entry.uid ?? 'entry'}-${entry.ts ?? index}`}>
                <td>{entry.ts ?? ''}</td>
                <td>{entry.choice ?? ''}</td>
                <td>{entry.probabilities?.trash ?? ''}</td>
                <td>{entry.subject ?? ''}</td>
                <td>{entry.action ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
