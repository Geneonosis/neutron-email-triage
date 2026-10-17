import { useState } from 'react';
import { Braces, RefreshCw, Sparkles } from 'lucide-react';
import type { ChipState } from '../StatusChip/StatusChip.js';
import { Card } from '../Card/Card.js';
import { Output } from '../Output/Output.js';

interface ResourcePanelProps {
  title: 'Health' | 'Config';
  state: ChipState;
  value: unknown;
  busy: boolean;
  onRefresh: () => void;
}

type ResourceTab = 'rich' | 'json';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function displayValue(value: unknown): string {
  if (value == null || value === '') return 'Not set';
  if (typeof value === 'boolean') return value ? 'Configured' : 'Not configured';
  return String(value);
}

function ResourceDetails({ title, value }: { title: ResourcePanelProps['title']; value: unknown }) {
  const response = record(value);
  const details = record(title === 'Health' ? response.checks : response.config);
  const rows = title === 'Health'
    ? [
        { label: 'Mail connection', value: `${displayValue(details.bridgeHost)}:${displayValue(details.bridgePort)}` },
        { label: 'Bridge username', value: details.hasBridgeUsername ? 'Configured' : 'Not configured', ready: Boolean(details.hasBridgeUsername) },
        { label: 'Bridge password', value: details.hasBridgePassword ? 'Configured' : 'Not configured', ready: Boolean(details.hasBridgePassword) },
        { label: 'TypeSafe API key', value: details.hasTypeSafeKey ? 'Configured' : 'Not configured', ready: Boolean(details.hasTypeSafeKey) },
      ]
    : [
        { label: 'Classification model', value: displayValue(details.model) },
        { label: 'Mail connection', value: `${displayValue(details.bridgeHost)}:${displayValue(details.bridgePort)}` },
        { label: 'Bridge username', value: displayValue(details.bridgeUsername), ready: Boolean(details.bridgeUsername) },
        { label: 'Bridge password', value: displayValue(details.bridgePasswordMasked), ready: Boolean(details.bridgePasswordMasked) },
        { label: 'TypeSafe API key', value: displayValue(details.typeSafeKeyMasked), ready: Boolean(details.typeSafeKeyMasked) },
        { label: 'Auto-trash confidence', value: typeof details.minTrashThreshold === 'number' ? `${Math.round(details.minTrashThreshold * 100)}%` : 'Not set' },
        { label: 'Decision history file', value: displayValue(details.decisionsLog) },
      ];

  if (!value) {
    return <p className="empty-results">Refresh {title.toLowerCase()} to view these details.</p>;
  }

  return (
    <dl className="resource-details">
      {rows.map(({ label, value: rowValue, ready }) => (
        <div className="resource-detail" key={label}>
          <dt>{label}</dt>
          <dd className={ready === undefined ? '' : ready ? 'resource-ready' : 'resource-missing'}>
            {rowValue}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ResourcePanel({ title, state, value, busy, onRefresh }: ResourcePanelProps) {
  const [activeTab, setActiveTab] = useState<ResourceTab>('rich');
  const tabId = title.toLowerCase();

  return (
    <Card title={title} state={state}>
      <button className="ghost" onClick={onRefresh} disabled={busy}>
        <RefreshCw aria-hidden="true" size={14} /> Refresh {title.toLowerCase()}
      </button>
      <div className="result-tabs">
        <div className="tab-list" role="tablist" aria-label={`${title} view`}>
          <button
            id={`${tabId}-rich-tab`}
            className="tab-button"
            role="tab"
            aria-selected={activeTab === 'rich'}
            aria-controls={`${tabId}-rich-panel`}
            onClick={() => setActiveTab('rich')}
          >
            <Sparkles aria-hidden="true" size={14} /> Rich UI
          </button>
          <button
            id={`${tabId}-json-tab`}
            className="tab-button"
            role="tab"
            aria-selected={activeTab === 'json'}
            aria-controls={`${tabId}-json-panel`}
            onClick={() => setActiveTab('json')}
          >
            <Braces aria-hidden="true" size={14} /> JSON
          </button>
        </div>
        <div
          id={`${tabId}-rich-panel`}
          role="tabpanel"
          aria-labelledby={`${tabId}-rich-tab`}
          hidden={activeTab !== 'rich'}
        >
          <ResourceDetails title={title} value={value} />
        </div>
        <div
          id={`${tabId}-json-panel`}
          role="tabpanel"
          aria-labelledby={`${tabId}-json-tab`}
          hidden={activeTab !== 'json'}
        >
          <Output value={value} />
        </div>
      </div>
    </Card>
  );
}
