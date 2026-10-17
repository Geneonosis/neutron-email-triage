import { fireEvent, render, screen } from '@testing-library/react';
import { ResourcePanel } from '../ResourcePanel.js';

describe('ResourcePanel', () => {
  it('shows human-friendly health details and switches to JSON', () => {
    const onRefresh = jest.fn();
    render(
      <ResourcePanel
        title="Health"
        state="ok"
        value={{
          ok: true,
          command: 'health',
          checks: {
            bridgeHost: 'localhost',
            bridgePort: 1143,
            hasBridgeUsername: true,
            hasBridgePassword: false,
            hasTypeSafeKey: true,
          },
        }}
        busy={false}
        onRefresh={onRefresh}
      />,
    );

    expect(screen.getByText('Mail connection')).toBeInTheDocument();
    expect(screen.getByText('localhost:1143')).toBeInTheDocument();
    expect(screen.getByText('Bridge username')).toBeInTheDocument();
    expect(screen.getByText('Not configured')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'JSON' }));
    expect(screen.getByText(/"command": "health"/)).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Rich UI' }));
    expect(screen.getByText('Mail connection')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh health' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('presents configuration with readable labels and retains masked secrets', () => {
    render(
      <ResourcePanel
        title="Config"
        state="ok"
        value={{
          config: {
            model: 'jev-1.14.0',
            decisionsLog: 'decisions.jsonl',
            bridgeHost: '127.0.0.1',
            bridgePort: 1143,
            bridgeUsername: 'user@example.com',
            bridgePasswordMasked: 'abc***',
            typeSafeKeyMasked: 'key***',
            minTrashThreshold: 0.9,
          },
        }}
        busy={false}
        onRefresh={jest.fn()}
      />,
    );
    expect(screen.getByText('Classification model')).toBeInTheDocument();
    expect(screen.getByText('Auto-trash confidence')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('abc***')).toBeInTheDocument();
    expect(screen.getByText('key***')).toBeInTheDocument();
    expect(screen.queryByText('abc')).not.toBeInTheDocument();
  });

  it('disables refresh while loading', () => {
    render(
      <ResourcePanel title="Config" state="loading" value={null} busy onRefresh={jest.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Refresh config' })).toBeDisabled();
  });
});
