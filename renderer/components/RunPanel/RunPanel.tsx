import type { MailDestination, WorkerResponse } from '../../../types.js';
import { useState } from 'react';
import { Braces, Play, ScanLine, Sparkles } from 'lucide-react';
import { Card } from '../Card/Card.js';
import { Output } from '../Output/Output.js';
import { RecommendationItem } from '../RecommendationItem/RecommendationItem.js';
import type { ChipState } from '../StatusChip/StatusChip.js';
import type { RunForm } from '../../context/AppContext.js';
export type { RunForm } from '../../context/AppContext.js';

interface RunPanelProps {
  state: ChipState;
  busy: boolean;
  form: RunForm;
  result: unknown;
  actionBusy: Record<number, MailDestination | undefined>;
  onFormChange: <K extends keyof RunForm>(key: K, value: RunForm[K]) => void;
  onRun: () => void;
  onMessageAction: (uid: number, destination: MailDestination) => void;
}

type OutputTab = 'tsx' | 'json';

function RecommendationList({
  recommendations,
  actionBusy,
  onMessageAction,
}: {
  recommendations: NonNullable<WorkerResponse['recommendations']>;
  actionBusy: Record<number, MailDestination | undefined>;
  onMessageAction: RunPanelProps['onMessageAction'];
}) {
  if (recommendations.length === 0) {
    return <p className="empty-results">Run a scan to see email recommendations here.</p>;
  }

  return (
    <ul className="recommendation-list">
      {recommendations.map((email) => (
        <RecommendationItem
          key={email.uid}
          email={email}
          actionBusy={actionBusy[email.uid]}
          onMessageAction={onMessageAction}
        />
      ))}
    </ul>
  );
}

export function RunPanel({
  state,
  busy,
  form,
  result,
  actionBusy,
  onFormChange,
  onRun,
  onMessageAction,
}: RunPanelProps) {
  const [activeTab, setActiveTab] = useState<OutputTab>('tsx');
  const response = result && typeof result === 'object' ? result as WorkerResponse : null;
  const recommendations = Array.isArray(response?.recommendations) ? response.recommendations : [];

  return (
    <Card title="Run / Scan" state={state} className="full">
      <div className="row">
        <label>Limit <input type="number" min="1" value={form.limit}
          onChange={(event) => onFormChange('limit', Number(event.target.value))} /></label>
        <label>Offset <input type="number" min="0" value={form.offset}
          onChange={(event) => onFormChange('offset', Number(event.target.value))} /></label>
        <label>Threshold <input type="number" min="0.9" max="1" step="0.01" value={form.trashThreshold}
          onChange={(event) => onFormChange('trashThreshold', Number(event.target.value))} /></label>
      </div>
      <div className="row">
        <label><input type="checkbox" checked={form.includeBody}
          onChange={(event) => onFormChange('includeBody', event.target.checked)} /> include body</label>
        <label><input type="checkbox" checked={form.unreadOnly}
          onChange={(event) => onFormChange('unreadOnly', event.target.checked)} /> unread only</label>
        <label><input type="checkbox" checked={form.reclassify}
          onChange={(event) => onFormChange('reclassify', event.target.checked)} /> reclassify</label>
        <label><input type="checkbox" checked={form.execute}
          onChange={(event) => onFormChange('execute', event.target.checked)} /> execute</label>
        <button onClick={onRun} disabled={busy}>
          {busy ? <ScanLine aria-hidden="true" size={15} /> : <Play aria-hidden="true" size={15} />}
          {busy ? 'Running...' : 'Run now'}
        </button>
      </div>
      <div className="result-tabs">
        <div className="tab-list" role="tablist"         aria-label="Run view">
          <button
            id="run-tsx-tab"
            className="tab-button"
            role="tab"
            aria-selected={activeTab === 'tsx'}
            aria-controls="run-tsx-panel"
            onClick={() => setActiveTab('tsx')}
          >
            <Sparkles aria-hidden="true" size={14} /> Rich UI
          </button>
          <button
            id="run-json-tab"
            className="tab-button"
            role="tab"
            aria-selected={activeTab === 'json'}
            aria-controls="run-json-panel"
            onClick={() => setActiveTab('json')}
          >
            <Braces aria-hidden="true" size={14} /> JSON
          </button>
        </div>
        <div
          id="run-tsx-panel"
          role="tabpanel"
          aria-labelledby="run-tsx-tab"
          hidden={activeTab !== 'tsx'}
        >
          <RecommendationList
            recommendations={recommendations}
            actionBusy={actionBusy}
            onMessageAction={onMessageAction}
          />
        </div>
        <div
          id="run-json-panel"
          role="tabpanel"
          aria-labelledby="run-json-tab"
          hidden={activeTab !== 'json'}
        >
          <Output value={result} />
        </div>
      </div>
    </Card>
  );
}
