import { fireEvent, render, screen } from '@testing-library/react';
import { HistoryPanel } from '../HistoryPanel.js';

describe('HistoryPanel', () => {
  it('renders entries and reports refresh and limit changes', () => {
    const onLimitChange = jest.fn();
    const onRefresh = jest.fn();
    render(
      <HistoryPanel
        state="ok"
        busy={false}
        limit={25}
        entries={[{
          ts: '2026-10-17T00:00:00.000Z',
          messageId: 'receipt-1',
          subject: 'Order receipt',
          choice: 'keep',
          probabilities: { trash: 0.01 },
          action: 'logged-only',
        }]}
        onLimitChange={onLimitChange}
        onRefresh={onRefresh}
      />,
    );

    expect(screen.getByText('Order receipt')).toBeInTheDocument();
    expect(screen.getByText('logged-only')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: /show last/i }), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh history' }));

    expect(onLimitChange).toHaveBeenCalledWith(10);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
