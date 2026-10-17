import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { RunPanel } from './RunPanel.js';
import type { RunForm } from './RunPanel.js';

const form: RunForm = {
  limit: 20,
  offset: 0,
  includeBody: false,
  unreadOnly: false,
  reclassify: false,
  execute: false,
  trashThreshold: 0.95,
};

const meta = {
  title: 'Panels/RunPanel',
  component: RunPanel,
  args: {
    state: 'idle',
    busy: false,
    form,
    result: {
      recommendations: [{
        uid: 101,
        date: '2026-10-16T18:20:00.000Z',
        subject: 'Weekly update',
        from: 'news@example.com',
        confidence: 0.91,
        recommendation: 'archive',
        probabilities: { archive: 0.91 },
      }],
    },
    actionBusy: {},
    onFormChange: fn(),
    onRun: fn(),
    onMessageAction: fn(),
  },
} satisfies Meta<typeof RunPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('checkbox', { name: /include body/i }));
    await expect(args.onFormChange).toHaveBeenCalledWith('includeBody', true);
    await expect(canvas.getByText('Weekly update')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('tab', { name: 'JSON' }));
    await expect(canvas.getByText(/"subject": "Weekly update"/)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('tab', { name: 'Rich UI' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Archive Weekly update' }));
    await expect(args.onMessageAction).toHaveBeenCalledWith(101, 'archive');
    await userEvent.click(canvas.getByRole('button', { name: 'Run now' }));
    await expect(args.onRun).toHaveBeenCalledTimes(1);
  },
};

export const Busy: Story = {
  args: { state: 'loading', busy: true, result: { message: 'Processing...' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Running...' })).toBeDisabled();
    await expect(canvas.getByText(/"message": "Processing\.\.\."/)).toBeInTheDocument();
  },
};
