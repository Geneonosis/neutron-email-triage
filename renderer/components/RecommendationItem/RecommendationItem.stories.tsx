import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { RecommendationItem } from './RecommendationItem.js';

const email = {
  uid: 101,
  date: '2026-10-16T18:20:00.000Z',
  subject: 'Weekly update',
  from: 'news@example.com',
  confidence: 0.91,
  recommendation: 'archive',
  probabilities: { archive: 0.91 },
};

const meta = {
  title: 'Recommendations/RecommendationItem',
  component: RecommendationItem,
  args: {
    email,
    onMessageAction: fn(),
  },
} satisfies Meta<typeof RecommendationItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Recommended: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Weekly update')).toBeInTheDocument();
    await expect(canvas.getByRole('time')).toHaveTextContent(/2026|10\/16/);
    await expect(canvas.getByText('Weekly update').parentElement).toHaveTextContent(
      /Weekly update.*2026|Weekly update.*10\/16/,
    );
    await expect(canvas.getByText('news@example.com')).toBeInTheDocument();
    await expect(canvas.getByText('91.0%')).toBeInTheDocument();
    await expect(canvas.getByText('Recommendation').tagName).toBe('DT');
    await expect(canvas.getByText('Action').nextElementSibling).toHaveTextContent('Pending Decision');
    const sender = canvas.getByText('news@example.com');
    await expect(getComputedStyle(sender).whiteSpace).toBe('nowrap');
    await expect(getComputedStyle(sender).overflow).toBe('visible');
    await expect(getComputedStyle(sender).textOverflow).toBe('clip');
    await userEvent.click(canvas.getByRole('button', { name: 'Archive Weekly update' }));
    await expect(args.onMessageAction).toHaveBeenCalledWith(101, 'archive');
  },
};

export const MovingToArchive: Story = {
  args: { actionBusy: 'archive' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Archive Weekly update' })).toBeDisabled();
    await expect(canvas.getByText('Moving...')).toBeInTheDocument();
  },
};

export const Archived: Story = {
  args: { email: { ...email, action: 'moved-to-archive' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Archive Weekly update' })).toBeDisabled();
    await expect(canvas.getByText('moved to archive')).toBeInTheDocument();
  },
};

export const PendingDecision: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Action').nextElementSibling).toHaveTextContent('Pending Decision');
  },
};
