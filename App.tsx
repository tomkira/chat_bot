import React, { useState, useEffect, useCallback } from 'react';
import ChatInterface from './components/ChatInterface';
import HistorySidebar from './components/HistorySidebar';
import AdminSettingsModal from './components/AdminSettingsModal';
import type { ChatMessage } from './types';
import { Role } from './types';
import { sendMessageToN8n, reformatWithGemini } from './services/geminiService';
import n8n from './services/n8n.ts';

// Interface pour une conversation
interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  fileData: string;
  sheetData: string;
  sheetTitle: string | null;
}

const CHAT_HISTORY_KEY = 'gemini_data_analysis_chat_history';
const WELCOME_MESSAGE = '<div>Bonjour! Je suis votre assistant IA d\'analyse de données. Posez-moi vos questions et je vous aiderai à analyser et comprendre vos données.</div>';

const App: React.FC = () => {
  const [conversations, setConversations] = useState<Record<string, Conversation>>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isApiReady, setIsApiReady] = useState<boolean>(true); // Toujours true car on utilise n8n
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState(() => localStorage.getItem('webhookUrl') || '');
  const [isWebhookActive, setIsWebhookActive] = useState(() => JSON.parse(localStorage.getItem('isWebhookActive') || 'false'));

  const createNewChat = (): string => {
    const id = Date.now().toString();
    const newConversation: Conversation = {
      id,
      title: 'Nouveau Chat',
      messages: [
        {
          role: Role.MODEL,
          content: WELCOME_MESSAGE,
        },
      ],
      fileData: '',
      sheetData: '',
      sheetTitle: null,
    };
    setConversations(prev => ({ ...prev, [id]: newConversation }));
    return id;
  };

  useEffect(() => {
    // Toujours actif car on utilise n8n, pas Gemini API
    setInterval(()=>{
      n8n.ping().then(res=>{
        console.log({res});
        
      })
    },60000)
    setIsApiReady(true);
    try {
      const savedHistory = localStorage.getItem(CHAT_HISTORY_KEY);
      const parsedHistory = savedHistory ? JSON.parse(savedHistory) : {};
      if (Object.keys(parsedHistory).length > 0) {
        setConversations(parsedHistory);
        const mostRecentId = Object.keys(parsedHistory).sort((a, b) => parseInt(b) - parseInt(a))[0];
        setActiveChatId(mostRecentId);
      } else {
        const newId = createNewChat();
        setActiveChatId(newId);
      }
    } catch (error) {
      console.error("Failed to load chat history:", error);
      const newId = createNewChat();
      setActiveChatId(newId);
    }
  }, []);

  useEffect(() => {
    if (Object.keys(conversations).length > 0 && isApiReady) {
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(conversations));
    }
  }, [conversations, isApiReady]);

  const handleNewChat = () => {
    const newId = createNewChat();
    setActiveChatId(newId);
    setIsSidebarVisible(false);
  };

  const handleSelectChat = (id: string) => {
    setActiveChatId(id);
    setIsSidebarVisible(false);
  };
  
  const handleDeleteChat = (id: string) => {
    setConversations(prevConversations => {
        const newConversations = { ...prevConversations };
        delete newConversations[id];
        
        if (activeChatId === id) {
            const remainingIds = Object.keys(newConversations).sort((a,b) => parseInt(b) - parseInt(a));
            if (remainingIds.length > 0) {
                setActiveChatId(remainingIds[0]);
            } else {
                const newId = Date.now().toString();
                newConversations[newId] = {
                     id: newId,
                     title: 'Nouveau Chat',
                     messages: [{ role: Role.MODEL, content: WELCOME_MESSAGE }],
                     fileData: '', sheetData: '', sheetTitle: null,
                };
                setActiveChatId(newId);
            }
        }
        return newConversations;
    });
  };
  
  const updateActiveConversation = (updater: (prev: Conversation) => Conversation) => {
    if (activeChatId) {
        setConversations(prev => ({
            ...prev,
            [activeChatId]: updater(prev[activeChatId])
        }));
    }
  };
  
  const handleSetFileData = (data: string) => {
    updateActiveConversation(conv => ({ ...conv, fileData: data }));
  };

  const handleSetSheetData = (data: string, title: string) => {
    updateActiveConversation(conv => ({ ...conv, sheetData: data, sheetTitle: title || null }));
  };
  
  const handleSendMessage = useCallback(async (message: string) => {
    if (!activeChatId || !conversations[activeChatId]) return;

    const activeConv = conversations[activeChatId];
    
    const userMessage: ChatMessage = { role: Role.USER, content: message };
    const updatedMessages = [...activeConv.messages, userMessage];

    const isFirstUserMessage = activeConv.messages.filter(m => m.role === Role.USER).length === 0;
    const newTitle = isFirstUserMessage ? message.substring(0, 40) + (message.length > 40 ? '...' : '') : activeConv.title;
    
    updateActiveConversation(conv => ({
        ...conv,
        messages: updatedMessages,
        title: newTitle,
    }));
    
    setIsLoading(true);

    let dataContext = '';
    if (activeConv.fileData) {
        dataContext += `--- START OF FILE DATA ---\n${activeConv.fileData}\n--- END OF FILE DATA ---\n\n`;
    }
    if (activeConv.sheetData) {
        dataContext += `--- START OF GOOGLE SHEET DATA ---\n${activeConv.sheetData}\n--- END OF GOOGLE SHEET DATA ---\n\n`;
    }

    try {
      let responseContent: string;
      
      // Utiliser votre service n8n directement
      responseContent = await sendMessageToN8n(message, dataContext, updatedMessages, activeChatId);
      
      // Si le service n8n renvoie déjà un JSON avec graph et text, vous pouvez le traiter ici
      // Si ce n'est pas le cas, le service n8n devra renvoyer le format approprié
      
      updateActiveConversation(conv => ({
          ...conv,
          messages: [...updatedMessages, { role: Role.MODEL, content: responseContent }]
      }));
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      updateActiveConversation(conv => ({
          ...conv,
          messages: [...updatedMessages, { role: Role.MODEL, content: `
            <div class="bg-red-900/50 text-red-300 p-4 rounded-lg border border-red-700/50">
              <p class="font-bold">An Error Occurred</p>
              <p>${errorMessage}</p>
            </div>
          ` }]
      }));
    } finally {
      setIsLoading(false);
    }
  }, [activeChatId, conversations]); // Mis à jour pour enlever les dépendances inutiles

  const activeConversation = activeChatId ? conversations[activeChatId] : null;
  const historyForSidebar = Object.values(conversations)
    .sort((a: Conversation, b: Conversation) => parseInt(b.id) - parseInt(a.id))
    .map(({ id, title }) => ({ id, title }));

  return (
    <div className="relative h-screen bg-gray-900 text-white flex overflow-hidden">
      {/* Sidebar */}
      <div className={`fixed lg:relative inset-y-0 left-0 z-40 w-64 transition-transform duration-300 ease-in-out transform lg:translate-x-0 ${isSidebarVisible ? 'translate-x-0' : '-translate-x-full'}`}>
        {activeChatId && (
            <HistorySidebar
            conversations={historyForSidebar}
            activeChatId={activeChatId}
            onNewChat={handleNewChat}
            onSelectChat={handleSelectChat}
            onDeleteChat={handleDeleteChat}
            />
        )}
      </div>

      {/* Backdrop for Mobile Sidebar */}
      {isSidebarVisible && (
          <div onClick={() => setIsSidebarVisible(false)} className="fixed inset-0 bg-black/60 z-30 lg:hidden" aria-hidden="true" />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
          <div className="flex flex-col h-full p-2 sm:p-4 md:p-6">
              <header className="flex items-center mb-4 sm:mb-6 flex-shrink-0">
                  <button onClick={() => setIsSidebarVisible(true)} className="p-2 rounded-full hover:bg-gray-800 lg:hidden mr-2" aria-label="Open menu">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                  </button>
                  <div className='flex-1 text-center'>
                      <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                      Assistant d'Analyse de Données
                      </h1>
                      <p className="mt-1 text-sm text-gray-400">
                      Propulsé par votre service n8n
                      </p>
                  </div>
                  {/* <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 rounded-full hover:bg-gray-800 ml-2" aria-label="Open settings">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </button> */}
              </header>
              <main className="flex-1 min-h-0">
                  {activeConversation ? (
                       <ChatInterface 
                          key={activeChatId} 
                          messages={activeConversation.messages} 
                          onSendMessage={handleSendMessage} 
                          isLoading={isLoading} 
                          isApiReady={isApiReady}
                          fileData={activeConversation.fileData}
                          sheetTitle={activeConversation.sheetTitle}
                          onSetFileData={handleSetFileData}
                          onSetSheetData={handleSetSheetData}
                          isWebhookActive={isWebhookActive}
                       />
                  ) : (
                      <div className="w-full h-full flex items-center justify-center">
                          <p className="text-gray-500">Sélectionnez un chat ou démarrez une nouvelle conversation.</p>
                      </div>
                  )}
              </main>
          </div>
      </div>
      {/* Admin Settings Modal */}
      {isSettingsModalOpen && (
          <AdminSettingsModal
              onClose={() => setIsSettingsModalOpen(false)}
              webhookUrl={webhookUrl}
              setWebhookUrl={setWebhookUrl}
              isWebhookActive={isWebhookActive}
              setIsWebhookActive={setIsWebhookActive}
          />
      )}
    </div>
  );
};

export default App;