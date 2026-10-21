import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  Download,
  FolderSync,
  HardDrive,
  RefreshCw,
  Server,
  Shield,
  X,
} from 'lucide-react';
import type {
  CloudProviderConfig,
  CloudProviderId,
  StoredDocumentRecord,
  SyncQueueItem,
} from '../types/pdf';
import {
  exportFullWorkspaceBackupJson,
  loadCloudProviders,
  saveCloudProviders,
  syncDocumentWithCloud,
} from '../services/cloudSyncService';
import {
  clearSyncedQueueItems,
  listSyncQueueItems,
} from '../services/storageService';

interface CloudSyncModalProps {
  currentDoc: StoredDocumentRecord;
  onSyncCompleted: (
    status: 'synced' | 'pending-sync',
    provider: CloudProviderId,
    message: string
  ) => void;
  getExportedPdfBytes: () => Promise<Uint8Array>;
  onClose: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  currentDoc,
  onSyncCompleted,
  getExportedPdfBytes,
  onClose,
}) => {
  const [providers, setProviders] = useState<CloudProviderConfig[]>(() =>
    loadCloudProviders()
  );
  const [selectedProvider, setSelectedProvider] =
    useState<CloudProviderId>('google-drive');
  const [queue, setQueue] = useState<SyncQueueItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  useEffect(() => {
    listSyncQueueItems().then(setQueue);
  }, []);

  const currentProviderCfg =
    providers.find((p) => p.id === selectedProvider) || providers[0];

  const updateProviderField = (
    id: CloudProviderId,
    patch: Partial<CloudProviderConfig>
  ) => {
    const updated = providers.map((p) => (p.id === id ? { ...p, ...patch } : p));
    setProviders(updated);
    saveCloudProviders(updated);
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setStatusBanner(null);
    try {
      const pdfBytes = await getExportedPdfBytes();
      const res = await syncDocumentWithCloud(
        currentDoc,
        selectedProvider,
        pdfBytes
      );
      setStatusBanner(res.message);
      setQueue(await listSyncQueueItems());
      onSyncCompleted(res.status, selectedProvider, res.message);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                Offline-First Vault & Multi-Cloud Storage Sync
              </h3>
              <p className="text-xs text-slate-400">
                Work 100% offline in IndexedDB and sync with Google Drive,
                OneDrive, Dropbox, WebDAV, or Local Cloud Folders
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {statusBanner && (
            <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusBanner}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Left Provider Selector */}
            <div className="md:col-span-2 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                Storage Providers
              </div>
              {providers.map((prov) => (
                <button
                  key={prov.id}
                  onClick={() => setSelectedProvider(prov.id)}
                  className={`w-full text-start p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                    selectedProvider === prov.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-white'
                      : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {prov.id === 'webdav' ? (
                      <Server className="w-4 h-4 text-violet-400 shrink-0" />
                    ) : prov.id === 'local-folder' ? (
                      <HardDrive className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Cloud className="w-4 h-4 text-sky-400 shrink-0" />
                    )}
                    <div className="truncate">
                      <div className="font-semibold truncate">{prov.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {prov.connected ? 'Connected & Ready' : 'Click to Configure'}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      prov.connected ? 'bg-emerald-400' : 'bg-slate-600'
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Right Selected Provider Config & Sync Trigger */}
            <div className="md:col-span-3 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h4 className="font-bold text-sm text-white">
                    {currentProviderCfg.name}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Target Path: {currentProviderCfg.folderPath}
                  </p>
                </div>

                <button
                  onClick={() =>
                    updateProviderField(currentProviderCfg.id, {
                      connected: !currentProviderCfg.connected,
                      lastSyncedAt: new Date().toISOString(),
                    })
                  }
                  className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                    currentProviderCfg.connected
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {currentProviderCfg.connected ? 'Connected ✓' : 'Connect Provider'}
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-slate-400 mb-1">
                    Cloud Folder Path:
                  </label>
                  <input
                    type="text"
                    value={currentProviderCfg.folderPath || ''}
                    onChange={(e) =>
                      updateProviderField(currentProviderCfg.id, {
                        folderPath: e.target.value,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>

                {currentProviderCfg.id === 'webdav' && (
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Nextcloud / WebDAV Endpoint URL:
                    </label>
                    <input
                      type="text"
                      placeholder="https://cloud.example.com/remote.php/dav/files/user/KasbPro"
                      value={currentProviderCfg.webdavUrl || ''}
                      onChange={(e) =>
                        updateProviderField('webdav', {
                          webdavUrl: e.target.value,
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                )}

                {currentProviderCfg.id !== 'local-folder' && (
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Optional OAuth2 Access Token / App Password (stored locally):
                    </label>
                    <input
                      type="password"
                      placeholder="Paste Google Drive / OneDrive / Dropbox token or leave blank for Offline Queue"
                      value={currentProviderCfg.accessToken || ''}
                      onChange={(e) =>
                        updateProviderField(currentProviderCfg.id, {
                          accessToken: e.target.value,
                          connected: true,
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                )}

                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentProviderCfg.autoSync}
                    onChange={(e) =>
                      updateProviderField(currentProviderCfg.id, {
                        autoSync: e.target.checked,
                      })
                    }
                    className="rounded accent-indigo-500"
                  />
                  <span>
                    Auto-queue offline edits & sync reading position across
                    devices
                  </span>
                </label>
              </div>

              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  onClick={handleSyncNow}
                  disabled={isSyncing}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`}
                  />
                  <span>
                    {isSyncing
                      ? 'Syncing PDF & Annotations...'
                      : `Sync "${currentDoc.name}" with ${currentProviderCfg.name}`}
                  </span>
                </button>

                <button
                  onClick={exportFullWorkspaceBackupJson}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold flex items-center gap-1.5 cursor-pointer"
                  title="Download portable cloud backup file"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Backup JSON</span>
                </button>
              </div>
            </div>
          </div>

          {/* Offline Sync Queue Log */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-200 font-bold">
                <FolderSync className="w-4 h-4 text-indigo-400" />
                <span>Offline Sync Queue & Cloud Activity ({queue.length})</span>
              </div>
              {queue.length > 0 && (
                <button
                  onClick={async () => {
                    await clearSyncedQueueItems();
                    setQueue(await listSyncQueueItems());
                  }}
                  className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                >
                  Clear Completed
                </button>
              )}
            </div>

            {queue.length === 0 ? (
              <div className="text-slate-500 flex items-center gap-2 py-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>
                  All local changes are stored safely in your Offline Vault
                  (IndexedDB).
                </span>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {queue.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg border border-slate-800"
                  >
                    <div>
                      <span className="font-semibold text-slate-200">
                        {item.docName}
                      </span>
                      <span className="text-slate-500 ms-2">
                        • {item.provider}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        item.status === 'synced'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
