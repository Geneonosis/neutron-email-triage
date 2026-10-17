import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Output } from './Output.js';

const meta = {
  title: 'Components/Output',
  component: Output,
  args: {
    value: { ok: true, command: 'health', checks: { bridge: 'connected' } },
  },
} satisfies Meta<typeof Output>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Json: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/"command": "health"/)).toBeInTheDocument();
    const writeText = fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const copyButton = canvas.getByRole('button', { name: 'Copy JSON' });
    await expect(copyButton.parentElement?.parentElement).toHaveClass('json-output');
    await userEvent.click(copyButton);
    await expect(writeText).toHaveBeenCalledWith(JSON.stringify(meta.args.value, null, 2));
    await expect(canvas.getByRole('status')).toHaveTextContent('Copied JSON');
  },
};

export const Empty: Story = {
  args: { value: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Copy JSON' })).toBeDisabled();
  },
};
