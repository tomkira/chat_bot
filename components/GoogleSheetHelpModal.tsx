import React from 'react';

interface GoogleSheetHelpModalProps {
  onClose: () => void;
}

const GoogleSheetHelpModal: React.FC<GoogleSheetHelpModalProps> = ({ onClose }) => {
  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div 
        className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-300"
        onClick={onClose}
        aria-modal="true"
        role="dialog"
    >
      <div 
        className="bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-8 border border-gray-700 m-4"
        onClick={stopPropagation}
      >
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">How to Connect Your Sheet</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        <div className="space-y-4 text-gray-300">
            <p>To connect your data, you need to sign in with your Google account and provide the URL of the Google Sheet you want to analyze.</p>
            <ol className="list-decimal list-inside space-y-3 bg-gray-900/50 p-4 rounded-lg">
                <li>Click the <strong className="text-cyan-400">"Sign in with Google"</strong> button.</li>
                <li>Follow the prompts to sign in and grant the app <strong className="text-cyan-400">read-only access</strong> to your spreadsheets.</li>
                <li>Open your sheet in Google Sheets.</li>
                <li>Copy the <strong className="text-cyan-400">full URL</strong> from your browser's address bar.</li>
                <li>Paste the URL into the input field in the app and click "Connect Sheet".</li>
            </ol>
            <div className="text-xs text-gray-500 bg-gray-700/50 p-3 rounded-md mt-4">
                <strong className="text-yellow-400">Privacy Note:</strong> This application only requests read-only permission (view your spreadsheets). It cannot and will not modify your data in any way.
            </div>
        </div>

        <div className="flex justify-end pt-6">
            <button onClick={onClose} className="bg-cyan-600 text-white rounded-full py-2 px-8 hover:bg-cyan-500 transition-all duration-300">
                Got It
            </button>
        </div>
      </div>
    </div>
  );
};

export default GoogleSheetHelpModal;