import type { EmailRecommendation, MailDestination } from '../../../types.js';
import { Archive, Trash2 } from 'lucide-react';

export interface RecommendationItemProps {
  email: EmailRecommendation;
  actionBusy?: MailDestination;
  onMessageAction: (uid: number, destination: MailDestination) => void;
}

function formatDate(date: string | null): string {
  if (!date) return 'Unknown date';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleString();
}

function formatConfidence(confidence: number | null): string {
  return confidence == null ? 'Unavailable' : `${(confidence * 100).toFixed(1)}%`;
}

export function RecommendationItem({
  email,
  actionBusy,
  onMessageAction,
}: RecommendationItemProps) {
  const trashed = email.action === 'moved-to-trash';
  const archived = email.action === 'moved-to-archive';
  const actionComplete = trashed || archived;

  return (
    <li className="recommendation">
      <div className="recommendation-details">
        <div className="recommendation-heading">
          <h3>{email.subject}</h3>
          <time className="recommendation-date" dateTime={email.date ?? undefined}>
            {formatDate(email.date)}
          </time>
        </div>
        <dl className="recommendation-meta">
          <div className="recommendation-field recommendation-sender">
            <dt>From</dt>
            <dd>{email.from}</dd>
          </div>
          <div className="recommendation-field">
            <dt>Confidence</dt>
            <dd>{formatConfidence(email.confidence)}</dd>
          </div>
          <div className="recommendation-field">
            <dt>Recommendation</dt>
            <dd className={`recommendation-choice choice-${email.recommendation}`}>
              {email.recommendation}
            </dd>
          </div>
          <div className="recommendation-field recommendation-action-status">
            <dt>Action</dt>
            <dd className="action-status">
              {!email.action || email.action === 'logged-only'
                ? 'Pending Decision'
                : email.action.replaceAll('-', ' ')}
            </dd>
          </div>
        </dl>
      </div>
      <div className="recommendation-actions">
        <button
          className="danger-button"
          aria-label={`Trash ${email.subject}`}
          disabled={Boolean(actionBusy) || actionComplete}
          onClick={() => onMessageAction(email.uid, 'trash')}
        >
          <Trash2 aria-hidden="true" size={14} />
          {actionBusy === 'trash' ? 'Moving...' : trashed ? 'Trashed' : 'Trash'}
        </button>
        <button
          className="ghost"
          aria-label={`Archive ${email.subject}`}
          disabled={Boolean(actionBusy) || actionComplete}
          onClick={() => onMessageAction(email.uid, 'archive')}
        >
          <Archive aria-hidden="true" size={14} />
          {actionBusy === 'archive' ? 'Moving...' : archived ? 'Archived' : 'Archive'}
        </button>
      </div>
    </li>
  );
}
