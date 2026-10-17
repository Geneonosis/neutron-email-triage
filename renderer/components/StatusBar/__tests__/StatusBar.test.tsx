import { render, screen } from '@testing-library/react';
import { StatusBar } from '../StatusBar.js';

describe('StatusBar', () => {
  it('shows the current message and working indicator', () => {
    render(<StatusBar message="Refreshing health..." working />);

    expect(screen.getByText('Refreshing health...')).toBeInTheDocument();
    expect(screen.getByText('Working...')).toBeInTheDocument();
  });

  it('hides the working indicator when idle', () => {
    render(<StatusBar message="Ready" working={false} />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.queryByText('Working...')).not.toBeInTheDocument();
  });
});
