import React, { useState, useEffect } from 'react';

interface AdminSettingsModalProps {
  onClose: () => void;
  webhookUrl: string;
  setWebhookUrl: (url: string) => void;
  isWebhookActive: boolean;
  setIsWebhookActive: (active: boolean) => void;
}

const AdminSettingsModal: React.FC<AdminSettingsModalProps> = ({
  onClose,
  webhookUrl,
  setWebhookUrl,
  isWebhookActive,
  setIsWebhookActive,
}) => {
  const [localWebhookUrl, setLocalWebhookUrl] = useState(webhookUrl);
  const [localIsWebhookActive, setLocalIsWebhookActive] = useState(isWebhookActive);

  useEffect(() => {
    setLocalWebhookUrl(webhookUrl);
    setLocalIsWebhookActive(isWebhookActive);
  }, [webhookUrl, isWebhookActive]);

  const handleSave = () => {
    setWebhookUrl(localWebhookUrl);
    setIsWebhookActive(localIsWebhookActive);
    localStorage.setItem('webhookUrl', localWebhookUrl);
    localStorage.setItem('isWebhookActive', JSON.stringify(localIsWebhookActive));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold text-cyan-400 mb-4">Paramètres Admin</h2>

        <div className="mb-4">
          <label htmlFor="webhook-url" className="block text-gray-300 text-sm font-bold mb-2">
            URL du Webhook
          </label>
          <input
            type="url"
            id="webhook-url"
            className="shadow appearance-none border border-gray-700 rounded w-full py-2 px-3 bg-gray-900 text-gray-300 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-cyan-500"
            placeholder="https://your-webhook-endpoint.com"
            value={localWebhookUrl}
            onChange={(e) => setLocalWebhookUrl(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between mb-6">
          <span className="text-gray-300 text-sm font-bold">Activer le Webhook</span>
          <label htmlFor="webhook-toggle" className="flex items-center cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                id="webhook-toggle"
                className="sr-only"
                checked={localIsWebhookActive}
                onChange={(e) => setLocalIsWebhookActive(e.target.checked)}
              />
              <div className="block bg-gray-600 w-14 h-8 rounded-full"></div>
              <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition ${localIsWebhookActive ? 'translate-x-full bg-cyan-500' : ''}`}></div>
            </div>
          </label>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="bg-gray-600 text-white rounded-full py-2 px-6 hover:bg-gray-500 transition-all duration-300"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white rounded-full py-2 px-6 hover:bg-blue-500 transition-all duration-300"
          >
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsModal;
