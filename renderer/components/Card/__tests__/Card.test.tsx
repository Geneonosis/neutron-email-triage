import { render, screen } from '@testing-library/react';
import { Card } from '../Card.js';

describe('Card', () => {
  it('renders its title, status, and children', () => {
    render(<Card title="Health" state="ok"><p>All checks passed</p></Card>);

    expect(screen.getByRole('heading', { name: 'Health' })).toBeInTheDocument();
    expect(screen.getByText('Loaded')).toBeInTheDocument();
    expect(screen.getByText('All checks passed')).toBeInTheDocument();
  });
});
