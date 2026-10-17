import { fireEvent, render, screen } from '@testing-library/react';
import type { EmailRecommendation } from '../../../../types.js';
import { RecommendationItem } from '../RecommendationItem.js';

const email: EmailRecommendation = {
  uid: 15,
  date: '2026-10-16T18:20:00.000Z',
  subject: 'Weekly update',
  from: 'news@example.com',
  confidence: 0.91,
  recommendation: 'archive',
  probabilities: { archive: 0.91 },
};

describe('RecommendationItem', () => {
  it('shows email details and requests the selected action', () => {
    const onMessageAction = jest.fn();
    render(<ul><RecommendationItem email={email} onMessageAction={onMessageAction} /></ul>);

    expect(screen.getByText('Weekly update')).toBeInTheDocument();
    expect(screen.getByText('news@example.com')).toBeInTheDocument();
    expect(screen.getByText('91.0%')).toBeInTheDocument();
    expect(screen.getByText('archive')).toBeInTheDocument();
    expect(screen.getByText('Action').nextElementSibling).toHaveTextContent('Pending Decision');
    expect(screen.getByText('From').closest('dl')).toHaveClass('recommendation-meta');
    expect(screen.getByText('Confidence').tagName).toBe('DT');
    expect(screen.getByRole('time')).toHaveAttribute('dateTime', email.date);

    fireEvent.click(screen.getByRole('button', { name: 'Trash Weekly update' }));
    expect(onMessageAction).toHaveBeenCalledWith(15, 'trash');
  });

  it('disables both actions while moving and after a completed move', () => {
    const { rerender } = render(
      <ul><RecommendationItem email={email} actionBusy="archive" onMessageAction={jest.fn()} /></ul>,
    );
    expect(screen.getByRole('button', { name: 'Archive Weekly update' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Trash Weekly update' })).toBeDisabled();

    rerender(
      <ul>
        <RecommendationItem
          email={{ ...email, action: 'moved-to-archive' }}
          onMessageAction={jest.fn()}
        />
      </ul>,
    );
    expect(screen.getByRole('button', { name: 'Archive Weekly update' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Trash Weekly update' })).toBeDisabled();
    expect(screen.getByText('moved to archive')).toBeInTheDocument();
  });

  it('handles missing date and confidence', () => {
    render(
      <ul>
        <RecommendationItem
          email={{ ...email, date: null, confidence: null }}
          onMessageAction={jest.fn()}
        />
      </ul>,
    );
    expect(screen.getByText('Unknown date')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Action').nextElementSibling).toHaveTextContent('Pending Decision');
  });

  it('shows completed action status', () => {
    render(
      <ul>
        <RecommendationItem email={{ ...email, action: 'moved-to-trash' }} onMessageAction={jest.fn()} />
      </ul>,
    );
    expect(screen.getByText('Action').nextElementSibling).toHaveTextContent('moved to trash');
  });
});
