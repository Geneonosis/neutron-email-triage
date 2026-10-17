import { HistoryPanel } from './components/HistoryPanel/HistoryPanel.js';
import { ResourcePanel } from './components/ResourcePanel/ResourcePanel.js';
import { RunPanel } from './components/RunPanel/RunPanel.js';
import { StatusBar } from './components/StatusBar/StatusBar.js';
import { useAppContext } from './context/AppContext.js';

function App() {
  const {
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
  } = useAppContext();

  return (
    <>
      <header>
        <h1 className="title">Neutron Email Triage</h1>
        <div className="subtitle">CLI contract-backed Electron UI</div>
      </header>
      <main>
        <ResourcePanel title="Health" state={statuses.health} value={health}
          busy={busy.health} onRefresh={() => void refreshHealth()} />
        <ResourcePanel title="Config" state={statuses.config} value={config}
          busy={busy.config} onRefresh={() => void refreshConfig()} />
        <RunPanel state={statuses.run} busy={busy.run} form={form} result={runResult}
          actionBusy={actionBusy}
          onFormChange={updateForm} onRun={() => void runTriage()}
          onMessageAction={(uid, destination) => void moveMessage(uid, destination)} />
        <HistoryPanel state={statuses.history} busy={busy.history} limit={historyLimit}
          entries={history} onLimitChange={setHistoryLimit}
          onRefresh={() => void refreshHistory()} />
      </main>
      <StatusBar message={globalStatus} working={activeRequests > 0} />
    </>
  );
}

export default App;
