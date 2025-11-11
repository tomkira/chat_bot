import React from 'react';

interface ConversationSummary {
  id: string;
  title: string;
}

interface HistorySidebarProps {
  conversations: ConversationSummary[];
  activeChatId: string | null;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
}

const HistorySidebar: React.FC<HistorySidebarProps> = ({ conversations, activeChatId, onNewChat, onSelectChat, onDeleteChat }) => {
  return (
    <div className="bg-gray-800 h-full flex flex-col p-4 border-r border-gray-700/50">
      <button
        onClick={onNewChat}
        className="w-full bg-cyan-600 text-white rounded-full py-2.5 px-4 mb-6 hover:bg-cyan-500 transition-all duration-300 flex items-center justify-center font-semibold text-sm shadow-md"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
        Nouveau Chat
      </button>
      <div className="flex-grow overflow-y-auto space-y-2 -mr-2 pr-2">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSelectChat(conv.id)}
            className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors duration-200 ${
              activeChatId === conv.id ? 'bg-gray-700/80' : 'hover:bg-gray-700/50'
            }`}
          >
            <p className="truncate text-sm text-gray-300">{conv.title}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteChat(conv.id);
              }}
              className="text-gray-500 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity ml-2 flex-shrink-0"
              aria-label="Delete chat"
            >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistorySidebar;
