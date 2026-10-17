import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { CliResult, HistoryEntry, MailDestination, RunOptions, WorkerResponse } from '../../types.js';
import type { ChipState } from '../components/StatusChip/StatusChip.js';

export interface RunForm extends RunOptions {
  limit: number;
  offset: number;
  includeBody: boolean;
  unreadOnly: boolean;
  reclassify: boolean;
  execute: boolean;
  trashThreshold: number;
}

type Section = 'health' | 'config' | 'run' | 'history';

const initialRunForm: RunForm = {
  limit: 20,
  offset: 0,
  includeBody: false,
  unreadOnly: false,
  reclassify: false,
  execute: false,
  trashThreshold: 0.95,
};

const sectionLabels: Record<Section, string> = {
  health: 'Health',
  config: 'Config',
  run: 'Run / Scan',
  history: 'History',
};

function resultPayload(result: CliResult) {
  return result.parsed ?? {
    ok: result.code === 0,
    code: result.code,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

function isOkResult(result: CliResult): boolean {
  return result.parsed ? result.parsed.ok !== false : result.code === 0;
}

interface AppContextValue {
  statuses: Record<Section, ChipState>;
  busy: Record<Section, boolean>;
  activeRequests: number;
  globalStatus: string;
  health: unknown;
  config: unknown;
  runResult: unknown;
  actionBusy: Record<number, MailDestination | undefined>;
  history: HistoryEntry[];
  historyLimit: number;
  form: RunForm;
  setHistoryLimit: (limit: number) => void;
  updateForm: <K extends keyof RunForm>(key: K, value: RunForm[K]) => void;
  refreshHealth: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  runTriage: () => Promise<void>;
  moveMessage: (uid: number, destination: MailDestination) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [statuses, setStatuses] = useState<Record<Section, ChipState>>({
    health: 'idle',
    config: 'idle',
    run: 'idle',
    history: 'idle',
  });
  const [busy, setBusy] = useState<Record<Section, boolean>>({
    health: false,
    config: false,
    run: false,
    history: false,
  });
  const [activeRequests, setActiveRequests] = useState(0);
  const [globalStatus, setGlobalStatus] = useState('Booting...');
  const [health, setHealth] = useState<unknown>(null);
  const [config, setConfig] = useState<unknown>(null);
  const [runResult, setRunResult] = useState<unknown>(null);
  const [actionBusy, setActionBusy] = useState<Record<number, MailDestination | undefined>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLimit, setHistoryLimit] = useState(25);
  const [form, setForm] = useState<RunForm>(initialRunForm);

  const perform = useCallback(async (
    section: Section,
    message: string,
    action: () => Promise<void>,
  ): Promise<void> => {
    setBusy((current) => ({ ...current, [section]: true }));
    setStatuses((current) => ({ ...current, [section]: 'loading' }));
    setActiveRequests((count) => count + 1);
    setGlobalStatus(message);
    try {
      await action();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`[ui] ${section} failed`, error);
      setStatuses((current) => ({ ...current, [section]: 'err' }));
      setGlobalStatus(`${sectionLabels[section]} failed: ${detail}`);
    } finally {
      setBusy((current) => ({ ...current, [section]: false }));
      setActiveRequests((count) => Math.max(0, count - 1));
    }
  }, []);

  const refreshHealth = useCallback(() => perform('health', 'Refreshing health...', async () => {
    const result = await window.triage.health();
    console.log('[ui] health response', result);
    setHealth(resultPayload(result));
    const ok = isOkResult(result);
    setStatuses((current) => ({ ...current, health: ok ? 'ok' : 'err' }));
    setGlobalStatus(ok ? 'Health loaded' : 'Health failed');
  }), [perform]);

  const refreshConfig = useCallback(() => perform('config', 'Refreshing config...', async () => {
    const result = await window.triage.config();
    console.log('[ui] config response', result);
    setConfig(resultPayload(result));
    const ok = isOkResult(result);
    setStatuses((current) => ({ ...current, config: ok ? 'ok' : 'err' }));
    setGlobalStatus(ok ? 'Config loaded' : 'Config failed');
  }), [perform]);

  const refreshHistory = useCallback(() => perform('history', 'Refreshing history...', async () => {
    const result = await window.triage.history(historyLimit);
    console.log('[ui] history response', result);
    const payload = resultPayload(result);
    const entries = Array.isArray(payload.entries) ? payload.entries : [];
    setHistory(entries);
    const ok = isOkResult(result);
    setStatuses((current) => ({ ...current, history: ok ? 'ok' : 'err' }));
    setGlobalStatus(ok ? `History loaded (${entries.length})` : 'History failed');
  }), [historyLimit, perform]);

  const runTriage = useCallback(() => perform('run', 'Running triage...', async () => {
    const result = await window.triage.run(form);
    console.log('[ui] run response', result);
    setRunResult(resultPayload(result));
    const ok = isOkResult(result);
    setStatuses((current) => ({ ...current, run: ok ? 'ok' : 'err' }));
    const historyResult = await window.triage.history(historyLimit);
    const entries = resultPayload(historyResult).entries;
    setHistory(Array.isArray(entries) ? entries : []);
    setStatuses((current) => ({
      ...current,
      history: isOkResult(historyResult) ? 'ok' : 'err',
    }));
    setGlobalStatus(ok ? 'Run complete' : 'Run failed');
  }), [form, historyLimit, perform]);

  const moveMessage = useCallback(async (
    uid: number,
    destination: MailDestination,
  ): Promise<void> => {
    const label = destination === 'trash' ? 'Trash' : 'Archive';
    if (!window.confirm(`Move this email to ${label}?`)) return;

    setActionBusy((current) => ({ ...current, [uid]: destination }));
    setGlobalStatus(`Moving email to ${label}...`);
    try {
      const result = await window.triage.move(uid, destination);
      if (!isOkResult(result)) {
        throw new Error(result.parsed?.error ?? result.stderr ?? `Could not move email to ${label}.`);
      }
      const action = destination === 'trash' ? 'moved-to-trash' : 'moved-to-archive';
      setRunResult((current: unknown) => {
        if (!current || typeof current !== 'object') return current;
        const response = current as WorkerResponse;
        return {
          ...response,
          recommendations: response.recommendations?.map((email) =>
            email.uid === uid ? { ...email, action } : email,
          ),
        };
      });
      setGlobalStatus(`Email moved to ${label}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`[ui] move to ${label} failed`, error);
      setGlobalStatus(`Could not move email to ${label}: ${detail}`);
    } finally {
      setActionBusy((current) => ({ ...current, [uid]: undefined }));
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadInitialData = async () => {
      setGlobalStatus('Initial load...');
      for (const refresh of [refreshHealth, refreshConfig, refreshHistory]) {
        if (!mounted) return;
        await refresh();
      }
      if (mounted) setGlobalStatus('Ready');
    };
    void loadInitialData();
    return () => { mounted = false; };
  }, []);

  const updateForm = useCallback(<K extends keyof RunForm>(key: K, value: RunForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const value: AppContextValue = {
    statuses,
    busy,
    activeRequests,
    globalStatus,
    health,
    config,
    runResult,
    actionBusy,
    history,
    historyLimit,
    form,
    setHistoryLimit,
    updateForm,
    refreshHealth,
    refreshConfig,
    refreshHistory,
    runTriage,
    moveMessage,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider.');
  }
  return context;
}
