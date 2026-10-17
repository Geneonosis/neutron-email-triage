import { render, screen } from '@testing-library/react';
import { StatusChip } from '../StatusChip.js';

describe('StatusChip', () => {
  it.each([
    ['idle', 'Idle'],
    ['loading', 'Loading...'],
    ['ok', 'Loaded'],
    ['err', 'Error'],
  ] as const)('shows the %s state', (state, label) => {
    render(<StatusChip state={state} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(document.querySelector(`.chip-${state} svg[aria-hidden="true"]`)).toBeInTheDocument();
  });
});
