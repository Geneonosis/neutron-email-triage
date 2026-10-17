import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { CliResult } from '../types.js';
import App from './App.js';
import { AppProvider } from './context/AppContext.js';

function result(parsed: Record<string, unknown>): CliResult {
  return { code: 0, stdout: '', stderr: '', parsed };
}

const api = {
  health: fn(async () => result({
    ok: true,
    checks: {
      bridgeHost: '127.0.0.1',
      bridgePort: 1143,
      hasBridgeUsername: true,
      hasBridgePassword: true,
      hasTypeSafeKey: true,
    },
  })),
  config: fn(async () => result({
    ok: true,
    config: {
      model: 'jev-1.14.0',
      bridgeHost: '127.0.0.1',
      bridgePort: 1143,
      bridgeUsername: 'triage@example.com',
      bridgePasswordMasked: 'pass***',
      typeSafeKeyMasked: 'key***',
      minTrashThreshold: 0.9,
      decisionsLog: 'decisions.jsonl',
    },
  })),
  history: fn(async () => result({ ok: true, entries: [] })),
  run: fn(async () => result({
    ok: true,
    recommendations: [{
      uid: 101,
      date: '2026-10-16T18:20:00.000Z',
      subject: 'App story result',
      from: 'news@example.com',
      confidence: 0.91,
      recommendation: 'archive',
      probabilities: { archive: 0.91 },
    }],
  })),
  move: fn(async () => result({ ok: true })),
};

const meta = {
  title: 'App/Dashboard',
  component: App,
  decorators: [
    (Story: React.ComponentType) => (
      <AppProvider>
        <Story />
      </AppProvider>
    ),
  ],
  beforeEach: () => {
    const originalTriage = window.triage;
    Object.defineProperty(window, 'triage', { configurable: true, value: api });
    api.health.mockClear();
    api.config.mockClear();
    api.history.mockClear();
    api.run.mockClear();
    api.move.mockClear();
    return () => {
      if (originalTriage) {
        Object.defineProperty(window, 'triage', { configurable: true, value: originalTriage });
      } else {
        delete (window as Partial<Window>).triage;
      }
    };
  },
} satisfies Meta<typeof App>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dashboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Ready');
    await expect(canvas.getByRole('heading', { name: 'Proton Triage' })).toBeInTheDocument();
    await expect(canvas.getByText('Classification model')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Run now' }));
    await canvas.findByText('App story result');
    await expect(api.run).toHaveBeenCalledTimes(1);
    const runTabs = within(canvas.getByRole('tablist', { name: 'Run view' }));
    await userEvent.click(runTabs.getByRole('tab', { name: 'JSON' }));
    await expect(canvas.getByText(/"subject": "App story result"/)).toBeInTheDocument();
  },
};
