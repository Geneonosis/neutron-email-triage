import { fireEvent, render, screen } from '@testing-library/react';
import { RunPanel } from '../RunPanel.js';
import type { RunForm } from '../RunPanel.js';

const form: RunForm = {
  limit: 20,
  offset: 0,
  includeBody: false,
  unreadOnly: false,
  reclassify: false,
  execute: false,
  trashThreshold: 0.95,
};

describe('RunPanel', () => {
  it('reports option changes and starts the run', () => {
    const onFormChange = jest.fn();
    const onRun = jest.fn();
    render(
      <RunPanel
        state="idle"
        busy={false}
        form={form}
        result={{
          recommendations: [{
            uid: 15,
            date: '2026-10-16T18:20:00.000Z',
            subject: 'Weekly update',
            from: 'news@example.com',
            confidence: 0.91,
            recommendation: 'archive',
            probabilities: { archive: 0.91 },
          }],
        }}
        actionBusy={{}}
        onFormChange={onFormChange}
        onRun={onRun}
        onMessageAction={jest.fn()}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Rich UI' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Weekly update')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /include body/i }));
    fireEvent.change(screen.getByRole('spinbutton', { name: /limit/i }), { target: { value: '35' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run now' }));

    expect(onFormChange).toHaveBeenNthCalledWith(1, 'includeBody', true);
    expect(onFormChange).toHaveBeenNthCalledWith(2, 'limit', 35);
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it('switches between rendered recommendations and JSON without rerunning', () => {
    const onRun = jest.fn();
    const onMessageAction = jest.fn();
    render(
      <RunPanel
        state="ok"
        busy={false}
        form={form}
        result={{
          recommendations: [{
            uid: 15,
            date: '2026-10-16T18:20:00.000Z',
            subject: 'Weekly update',
            from: 'news@example.com',
            confidence: 0.91,
            recommendation: 'archive',
            probabilities: { archive: 0.91 },
          }],
        }}
        actionBusy={{}}
        onFormChange={jest.fn()}
        onRun={onRun}
        onMessageAction={onMessageAction}
      />,
    );

    expect(screen.getByText('Weekly update')).toBeVisible();
    expect(screen.getByText('news@example.com')).toBeVisible();
    expect(screen.getByText('91.0%')).toBeVisible();
    expect(screen.getByText('archive')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Archive Weekly update' }));
    expect(onMessageAction).toHaveBeenCalledWith(15, 'archive');

    fireEvent.click(screen.getByRole('tab', { name: 'JSON' }));
    expect(screen.getByText(/"subject": "Weekly update"/)).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Rich UI' }));
    expect(screen.getByText('Weekly update')).toBeVisible();
    expect(onRun).not.toHaveBeenCalled();
  });

  it('disables the run action while busy and renders its result', () => {
    render(
      <RunPanel
        state="loading"
        busy
        form={form}
        result={{ summary: { classified: 3 } }}
        actionBusy={{}}
        onFormChange={jest.fn()}
        onRun={jest.fn()}
        onMessageAction={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Running...' })).toBeDisabled();
    expect(screen.getByText(/classified/)).toBeInTheDocument();
  });
});
