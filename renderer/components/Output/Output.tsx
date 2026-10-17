import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function Output({ value }: { value: unknown }) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const json = value == null ? '' : pretty(value);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopyStatus('copied');
    } catch (error) {
      console.error('[ui] copy JSON failed', error);
      setCopyStatus('error');
    }
  };

  return (
    <div className="json-output">
      <div className="json-output-toolbar">
        {copyStatus === 'copied' && <span role="status">Copied JSON</span>}
        {copyStatus === 'error' && <span role="alert">Could not copy JSON</span>}
        <button className="ghost copy-button" onClick={() => void copyJson()} disabled={!json}>
          {copyStatus === 'copied'
            ? <Check aria-hidden="true" size={14} />
            : <Copy aria-hidden="true" size={14} />}
          {copyStatus === 'copied' ? 'Copied' : 'Copy JSON'}
        </button>
      </div>
      <pre>{json}</pre>
    </div>
  );
}
