import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { HistoryPanel } from './HistoryPanel.js';

const meta = {
  title: 'Panels/HistoryPanel',
  component: HistoryPanel,
  args: {
    state: 'ok',
    busy: false,
    limit: 25,
    entries: [
      {
        ts: '2026-10-17T00:00:00.000Z',
        uid: 101,
        messageId: 'receipt-101',
        subject: 'Order receipt',
        choice: 'keep',
        probabilities: { trash: 0.01 },
        action: 'logged-only',
      },
      {
        ts: '2026-10-16T23:45:00.000Z',
        uid: 102,
        messageId: 'newsletter-102',
        subject: 'Weekly newsletter',
        choice: 'review',
        probabilities: { trash: 0.45 },
        action: 'logged-only',
      },
    ],
    onLimitChange: fn(),
    onRefresh: fn(),
  },
} satisfies Meta<typeof HistoryPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithEntries: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Order receipt')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Refresh history' }));
    await expect(args.onRefresh).toHaveBeenCalledTimes(1);
  },
};

export const Empty: Story = {
  args: { entries: [] },
};
