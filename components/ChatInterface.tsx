import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';
import { Role } from '../types';
import DataSourceInput from './DataSourceInput';

// TypeScript declarations for libraries loaded via CDN
declare var html2canvas: any;
declare var jspdf: { jsPDF: new (options?: any) => any };

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isApiReady: boolean;
  fileData: string;
  sheetTitle: string | null;
  onSetFileData: (data: string) => void;
  onSetSheetData: (data: string, title: string) => void;
  isWebhookActive: boolean; // New prop for webhook active status
}

const HtmlContent: React.FC<{ html: string }> = ({ html }) => {
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (contentRef.current) {
            // Set the HTML content
            contentRef.current.innerHTML = html;

            // Find and execute scripts
            const scripts = contentRef.current.querySelectorAll('script');
            scripts.forEach(script => {
                const newScript = document.createElement('script');
                // copy attributes
                for (let i = 0; i < script.attributes.length; i++) {
                    const attr = script.attributes[i];
                    newScript.setAttribute(attr.name, attr.value);
                }
                newScript.innerHTML = script.innerHTML;
                script.parentNode?.replaceChild(newScript, script);
            });
        }
    }, [html]);

    return <div ref={contentRef} className="prose prose-invert prose-sm text-white max-w-none" />;
};


const ChatBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === Role.USER;
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleDownloadPdf = async () => {
    const element = bubbleRef.current;
    if (!element) return;

    // Temporarily remove the download button from the capture
    const downloadButton = element.querySelector('.download-pdf-button');
    if (downloadButton) (downloadButton as HTMLElement).style.display = 'none';

    try {
        const canvas = await html2canvas(element, {
            backgroundColor: isUser ? '#0891b2' : '#374151', // Match bubble background
            useCORS: true,
            scale: 2, // Higher resolution
        });
        
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jspdf.jsPDF({
            orientation: 'portrait',
            unit: 'px',
            format: [canvas.width, canvas.height],
        });
        
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save('data-analysis.pdf');
    } catch (error) {
        console.error("Error generating PDF:", error);
    } finally {
        // Restore the download button
        if (downloadButton) (downloadButton as HTMLElement).style.display = 'block';
    }
  };


  const bubbleClasses = isUser
    ? 'bg-cyan-600 self-end rounded-br-none'
    : 'bg-gray-700 self-start rounded-bl-none';
  const containerClasses = isUser ? 'justify-end' : 'justify-start';

  return (
    <div className={`w-full flex ${containerClasses} mb-4`}>
      <div 
        ref={bubbleRef}
        className={`relative max-w-[90%] sm:max-w-2xl lg:max-w-5xl px-4 py-3 sm:px-5 rounded-2xl shadow-md ${bubbleClasses}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {!isUser && isHovered && (
            <button
                onClick={handleDownloadPdf}
                className="download-pdf-button absolute top-2 right-2 p-1.5 bg-gray-800/50 rounded-full text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
                aria-label="Download as PDF"
                title="Download as PDF"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
            </button>
        )}
        {isUser ? (
            <p className="break-words">{message.content}</p>
        ) : (
            <HtmlContent html={message.content} />
        )}
      </div>
    </div>
  );
};

const DataSourceModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void;
    setFileData: (data: string) => void;
    setSheetData: (data: string, title: string) => void;
    sheetTitle: string | null;
    isWebhookActive: boolean; // New prop for webhook active status
}> = ({ isOpen, onClose, setFileData, setSheetData, sheetTitle, isWebhookActive }) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-300"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div 
                className="bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg border border-gray-700 m-4 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <DataSourceInput 
                    setFileData={setFileData}
                    setSheetData={setSheetData}
                    sheetTitle={sheetTitle}
                    isWebhookActive={isWebhookActive} // Pass isWebhookActive to DataSourceInput
                />
            </div>
        </div>
    );
};


const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isLoading, isApiReady, fileData, sheetTitle, onSetFileData, onSetSheetData, isWebhookActive }) => {
  const [input, setInput] = useState('');
  const [isDataSourceModalOpen, setIsDataSourceModalOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading && isApiReady) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const isFormDisabled = isLoading || !isApiReady;
  const placeholderText = !isApiReady
    ? "La clé API n'est pas configurée. Le chat est désactivé."
    : "Posez une question sur vos données...";

  return (
    <>
      <div className="bg-gray-800 rounded-2xl shadow-lg h-full flex flex-col">
        <div className="px-2 pt-4 sm:p-4 flex-grow overflow-y-auto">
          {messages.map((msg, index) => (
            <ChatBubble key={index} message={msg} />
          ))}
          {isLoading && (
              <div className="w-full flex justify-start mb-4">
                  <div className="max-w-xl px-5 py-3 rounded-2xl shadow-md bg-gray-700 self-start rounded-bl-none flex items-center space-x-2">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                  </div>
              </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="p-2 sm:p-4 border-t border-gray-700">
          <form onSubmit={handleSubmit} className="flex items-center space-x-2 sm:space-x-3">
            <button
              type="button"
              onClick={() => setIsDataSourceModalOpen(true)}
              disabled={isFormDisabled || isWebhookActive} // Disable if webhook is active
              className="flex-shrink-0 bg-gray-700 text-gray-400 rounded-full p-2.5 sm:p-3 hover:bg-gray-600 hover:text-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500"
              aria-label="Joindre des données"
              title="Joindre des données"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholderText}
              className="w-full bg-gray-900 border border-gray-700 rounded-full py-2.5 px-4 sm:py-3 sm:px-5 text-gray-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isFormDisabled}
            />
            <button
              type="submit"
              disabled={isFormDisabled || !input.trim()}
              className="flex-shrink-0 bg-cyan-600 text-white rounded-full p-2.5 sm:p-3 hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 -rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
          {(fileData || sheetTitle) && (
            <div className="text-xs text-gray-400 pt-2 px-4 flex items-center space-x-2 flex-wrap">
                <span className='font-semibold'>Contexte:</span>
                {fileData && <span className="bg-gray-700 px-2 py-0.5 rounded-full mt-1">Fichiers locaux</span>}
                {sheetTitle && <span className="bg-gray-700 px-2 py-0.5 rounded-full truncate max-w-xs mt-1">Sheet: {sheetTitle}</span>}
            </div>
          )}
        </div>
      </div>
      <DataSourceModal 
        isOpen={isDataSourceModalOpen}
        onClose={() => setIsDataSourceModalOpen(false)}
        setFileData={onSetFileData}
        setSheetData={onSetSheetData}
        sheetTitle={sheetTitle}
      />
    </>
  );
};

export default ChatInterface;
