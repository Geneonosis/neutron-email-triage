import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { StatusChip } from './StatusChip.js';

const meta = {
  title: 'Components/StatusChip',
  component: StatusChip,
  args: { state: 'ok' },
} satisfies Meta<typeof StatusChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Loaded')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  args: { state: 'loading' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Loading...')).toBeInTheDocument();
  },
};
