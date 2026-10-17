import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ResourcePanel } from './ResourcePanel.js';

const meta = {
  title: 'Panels/ResourcePanel',
  component: ResourcePanel,
  args: {
    title: 'Health',
    state: 'ok',
    value: { ok: true, command: 'health', checks: { bridgeHost: '127.0.0.1' } },
    busy: false,
    onRefresh: fn(),
  },
} satisfies Meta<typeof ResourcePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('127.0.0.1:Not set')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('tab', { name: 'JSON' }));
    await expect(canvas.getByText(/bridgeHost/)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Refresh health' }));
    await expect(args.onRefresh).toHaveBeenCalledTimes(1);
  },
};

export const Config: Story = {
  args: {
    title: 'Config',
    value: {
      ok: true,
      command: 'config',
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
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Classification model')).toBeInTheDocument();
    await expect(canvas.getByText('jev-1.14.0')).toBeInTheDocument();
    await expect(canvas.getByText('90%')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('tab', { name: 'JSON' }));
    await expect(canvas.getByText(/bridgePasswordMasked/)).toBeInTheDocument();
  },
};

export const Busy: Story = {
  args: { busy: true, state: 'loading' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Refresh health' })).toBeDisabled();
  },
};
