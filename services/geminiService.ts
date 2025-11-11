// services/geminiService.ts
import { ChatMessage, Role } from '../types';
import n8n from './n8n.ts';


// Ancienne fonction sendMessage (à supprimer ou garder pour fallback)
export const sendMessage = async (
  message: string,
  dataContext: string,
  history: ChatMessage[]
): Promise<string> => {
  // Votre ancienne implémentation Gemini ici
  // Si vous n'en avez pas, vous pouvez supprimer cette fonction
  // ou laisser une implémentation par défaut
  throw new Error('Gemini service not configured');
};

// Nouvelle fonction qui utilise votre service n8n
export const sendMessageToN8n = async (
  message: string,
  dataContext: string,
  history: ChatMessage[],
  userId: string = 'default_user'
): Promise<string> => {
  const fullMessage = {
    message,
    dataContext,
    history,
    userId
  };
  
  try {
    const response = await n8n.sendRequest(JSON.stringify(fullMessage), userId);
    return response;
  } catch (error) {
    console.error('Error sending message to n8n:', error);
    throw error;
  }
};

export const reformatWithGemini = async (content: string): Promise<string> => {
  // Votre implémentation actuelle
  // Si vous n'utilisez plus Gemini pour le reformatage, vous pouvez simplifier
  return content; // Retournez le contenu tel quel si pas de reformatage nécessaire
};