import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CliResult } from '../../../types.js';
import { AppProvider, useAppContext } from '../AppContext.js';

function Consumer() {
  const { globalStatus, history, runResult, actionBusy, runTriage, moveMessage } = useAppContext();
  return (
    <>
      <p data-testid="status">{globalStatus}</p>
      <p data-testid="history-count">{history.length}</p>
      <pre data-testid="run-result">{JSON.stringify(runResult)}</pre>
      <p data-testid="action-busy">{JSON.stringify(actionBusy)}</p>
      <button onClick={() => void runTriage()}>Run</button>
      <button onClick={() => void moveMessage(7, 'archive')}>Archive</button>
    </>
  );
}

const okResult = (parsed: CliResult['parsed']): CliResult => ({
  code: 0,
  stdout: '',
  stderr: '',
  parsed: parsed ?? { ok: true },
});

describe('AppProvider', () => {
  it('loads app data and coordinates a run and per-message action', async () => {
    const recommendation = {
      uid: 7,
      date: null,
      subject: 'Weekly update',
      from: 'news@example.com',
      confidence: 0.91,
      recommendation: 'archive',
      probabilities: { archive: 0.91 },
    };
    const api = {
      health: jest.fn().mockResolvedValue(okResult({ ok: true })),
      config: jest.fn().mockResolvedValue(okResult({ ok: true })),
      history: jest.fn().mockResolvedValue(okResult({ ok: true, entries: [{ uid: 7 }] })),
      run: jest.fn().mockResolvedValue(okResult({
        ok: true,
        recommendations: [recommendation],
      })),
      move: jest.fn().mockResolvedValue(okResult({ ok: true })),
    };
    Object.defineProperty(window, 'triage', { configurable: true, value: api });
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<AppProvider><Consumer /></AppProvider>);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('Ready'));
    expect(api.health).toHaveBeenCalledTimes(1);
    expect(api.config).toHaveBeenCalledTimes(1);
    expect(api.history).toHaveBeenCalledWith(25);
    expect(screen.getByTestId('history-count')).toHaveTextContent('1');

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(api.run).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      includeBody: false,
      unreadOnly: false,
      reclassify: false,
      execute: false,
      trashThreshold: 0.95,
    }));
    await waitFor(() => expect(screen.getByTestId('run-result')).toHaveTextContent('"subject":"Weekly update"'));
    expect(api.history).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(api.move).toHaveBeenCalledWith(7, 'archive'));
    await waitFor(() => expect(screen.getByTestId('run-result')).toHaveTextContent('"action":"moved-to-archive"'));
    expect(window.confirm).toHaveBeenCalledWith('Move this email to Archive?');
    expect(screen.getByTestId('status')).toHaveTextContent('Email moved to Archive');
  });
});
