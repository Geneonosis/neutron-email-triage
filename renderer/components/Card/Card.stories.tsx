import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Card } from './Card.js';

const meta = {
  title: 'Components/Card',
  component: Card,
  args: {
    title: 'Example panel',
    state: 'ok',
    children: <p>Panel contents</p>,
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Example panel' })).toBeInTheDocument();
    await expect(canvas.getByText('Panel contents')).toBeInTheDocument();
  },
};
