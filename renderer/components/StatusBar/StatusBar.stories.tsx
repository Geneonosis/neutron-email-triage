import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { StatusBar } from './StatusBar.js';

const meta = {
  title: 'Components/StatusBar',
  component: StatusBar,
  args: { message: 'Ready', working: false },
} satisfies Meta<typeof StatusBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Ready')).toBeInTheDocument();
    await expect(canvas.queryByText('Working...')).not.toBeInTheDocument();
  },
};

export const Working: Story = {
  args: { message: 'Refreshing health...', working: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Working...')).toBeInTheDocument();
  },
};
