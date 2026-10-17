import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Output } from '../Output.js';

describe('Output', () => {
  it('pretty prints structured values', () => {
    render(<Output value={{ ok: true, command: 'health' }} />);
    expect(screen.getByText(/"command": "health"/)).toBeInTheDocument();
  });

  it('renders an empty output for null values', () => {
    const { container } = render(<Output value={null} />);
    expect(container.querySelector('pre')).toBeEmptyDOMElement();
    expect(screen.getByRole('button', { name: 'Copy JSON' })).toBeDisabled();
  });

  it('copies the displayed JSON and reports success', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const value = { ok: true, command: 'health' };
    render(<Output value={value} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy JSON' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(JSON.stringify(value, null, 2)));
    expect(await screen.findByRole('status')).toHaveTextContent('Copied JSON');
  });

  it('reports clipboard failures', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('Clipboard unavailable'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(<Output value={{ ok: true }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy JSON' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not copy JSON');
  });
});
