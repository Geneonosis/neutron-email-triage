import { Activity, LoaderCircle } from 'lucide-react';

interface StatusBarProps {
  message: string;
  working: boolean;
}

export function StatusBar({ message, working }: StatusBarProps) {
  return (
    <div className="status-bar">
      <div className="status-message"><Activity aria-hidden="true" size={15} />{message}</div>
      {working && <div className="status-message"><LoaderCircle aria-hidden="true" className="icon-spin" size={15} />Working...</div>}
    </div>
  );
}
