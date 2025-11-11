import React, { useState, useCallback, useEffect } from 'react';
import GoogleSheetHelpModal from './GoogleSheetHelpModal';

// TypeScript declarations for libraries loaded via CDN
declare var XLSX: any;
declare var pdfjsLib: any;
declare var mammoth: any;
declare var google: any;
declare var gapi: any;
declare var Tesseract: any; // Declare Tesseract for OCR

const GOOGLE_CLIENT_ID = "544353097575-s1dn2n9gmpm1ao3ulvoil2hiloojs4qo.apps.googleusercontent.com";
const GOOGLE_REDIRECT_URI = window.location.origin; // Dynamically set redirect URI to current origin
const isGoogleSheetIntegrationEnabled = !!GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets.readonly';


interface DataSourceInputProps {
  setFileData: (data: string) => void;
  setSheetData: (data: string, title: string) => void;
  sheetTitle: string | null;
  isWebhookActive: boolean; // New prop for webhook active status
}

const extractSheetIdFromUrl = (url: string): string | null => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
};

const arrayToCsv = (data: any[][]): string => {
    return data.map(row => 
        row.map(cell => {
            const strCell = String(cell);
            // Escape quotes and handle commas
            if (strCell.includes('"') || strCell.includes(',')) {
                return `"${strCell.replace(/"/g, '""')}"`;
            }
            return strCell;
        }).join(',')
    ).join('\n');
};

const GoogleAuth: React.FC<{
    isSignedIn: boolean;
    onSignIn: () => void;
    onSignOut: () => void;
    user: any;
    isReady: boolean;
}> = ({ isSignedIn, onSignIn, onSignOut, user, isReady }) => {
    if (isSignedIn && user) {
        return (
            <div className="flex items-center justify-between bg-gray-700/50 p-2 rounded-md text-sm transition-all duration-300">
                <div className="flex items-center min-w-0">
                    <img src={user.picture} alt="User profile" className="w-6 h-6 rounded-full mr-2"/>
                    <span className="text-gray-300 truncate">{user.email}</span>
                </div>
                <button onClick={onSignOut} className="text-cyan-400 hover:text-cyan-300 text-xs font-semibold flex-shrink-0 ml-2">Déconnexion</button>
            </div>
        );
    }

    return (
        <button 
            onClick={onSignIn} 
            disabled={!isReady}
            className="w-full flex items-center justify-center bg-blue-600 text-white rounded-full py-2 px-6 hover:bg-blue-500 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 disabled:bg-gray-600 disabled:cursor-wait"
        >
             <svg className="w-5 h-5 mr-3" viewBox="0 0 48 48"><path fill="#4285F4" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#34A853" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#FBBC05" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path><path fill="#EA4335" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.021 35.596 44 30.134 44 24c0-1.341-.138-2.65-.389-3.917z"></path></svg>
            {isReady ? 'Se connecter avec Google' : 'Initialisation...'}
        </button>
    );
};


const DataSourceInput: React.FC<DataSourceInputProps> = ({ setFileData, setSheetData, sheetTitle, isWebhookActive }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false); // New state for OCR processing
  const [fileError, setFileError] = useState<string | null>(null);

  const [tokenClient, setTokenClient] = useState<any>(null);
  const [gisReady, setGisReady] = useState(false);
  const [user, setUser] = useState<any>(null);

  const [sheetUrl, setSheetUrl] = useState('');
  const [isConnectingSheet, setIsConnectingSheet] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  
  const isSignedIn = user !== null;

  useEffect(() => {
    // Restore sheet URL from localStorage on component mount
    const savedUrl = localStorage.getItem('googleSheetUrl');
    if (savedUrl) {
      setSheetUrl(savedUrl);
    }
  }, []);

  useEffect(() => {
    // Poll for Google libraries to be loaded and set readiness flags
    if (!isGoogleSheetIntegrationEnabled) return;

    const gapiPoll = setInterval(() => {
      if (typeof gapi !== 'undefined' && gapi && gapi.load) {
        clearInterval(gapiPoll);
      }
    }, 100);

    const gisPoll = setInterval(() => {
      if (typeof google !== 'undefined' && google && google.accounts) {
        clearInterval(gisPoll);
        setGisReady(true);
      }
    }, 100);

    return () => {
      clearInterval(gapiPoll);
      clearInterval(gisPoll);
    };
  }, []);

  useEffect(() => {
    // Initialize the token client once the GIS library is ready
    if (gisReady && isGoogleSheetIntegrationEnabled) {
        // Prevent Google from automatically selecting an account to ensure the user can always choose.
        if (google.accounts.id) {
            google.accounts.id.disableAutoSelect();
        }

        try {
            const client = google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: SCOPES,
                redirect_uri: GOOGLE_REDIRECT_URI, // Explicitly set redirect URI
                callback: (tokenResponse: any) => {
                    // After the user signs in and grants permission,
                    // this callback is triggered. We then load and initialize
                    // the GAPI client using the obtained access token.
                    gapi.load('client', async () => {
                        try {
                            if (tokenResponse.error) {
                                throw new Error(tokenResponse.error_description || 'An unknown authentication error occurred.');
                            }
                            
                            gapi.client.setToken(tokenResponse);

                            // Initialize GAPI client for Sheets API.
                            // The discovery is now authenticated with the OAuth token, not an API key.
                            await gapi.client.init({
                                discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
                            });

                            // Fetch user info
                            const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                                headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                            });
                            if (!userInfo.ok) {
                                throw new Error(`Failed to fetch user info (${userInfo.status})`);
                            }
                            const userData = await userInfo.json();
                            setUser(userData);
                            setSheetError(null); // Clear any previous errors on success
                        } catch (error: any) {
                            console.error("Error during GAPI initialization or user info fetch:", error);
                            const detailedMessage = error?.result?.error?.message || error?.details || (typeof error === 'object' ? JSON.stringify(error) : String(error));
                            setSheetError(`Sign-in failed: ${detailedMessage}`);
                            setUser(null);
                        }
                    });
                },
            });
            setTokenClient(client);
        } catch(error) {
            console.error("Failed to initialize Google token client:", error);
            setSheetError("Could not initialize Google Sign-In. Please try refreshing the page.");
        }
    }
  }, [gisReady]);
  

  const processFiles = useCallback(async (fileList: File[]) => {
    if (!fileList || fileList.length === 0) return;

    setIsProcessingFiles(true);
    setIsOcrProcessing(false); // Reset OCR processing state
    setFileError(null);
    setFiles(fileList);

    try {
        const fileContents = await Promise.all(fileList.map(file => {
            return new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                const fileExtension = file.name.split('.').pop()?.toLowerCase();
                reader.onload = async (e) => {
                    try {
                        const content = e.target?.result as ArrayBuffer;
                        let textContent = '';
                        if (fileExtension === 'csv' || fileExtension === 'txt' || fileExtension === 'tsv') {
                            textContent = new TextDecoder().decode(content);
                        } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
                            const workbook = XLSX.read(content, { type: 'array' });
                            workbook.SheetNames.forEach((sheetName: string) => {
                                textContent += `Sheet: ${sheetName}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName])}\n\n`;
                            });
                        } else if (fileExtension === 'pdf') {
                            const pdf = await pdfjsLib.getDocument({ data: content }).promise;
                            let fullText = '';
                            for (let i = 1; i <= pdf.numPages; i++) {
                                const page = await pdf.getPage(i);
                                const pageText = await page.getTextContent();
                                fullText += pageText.items.map((item: any) => item.str).join(' ');
                                fullText += '\n';
                            }
                            textContent = fullText;
                        } else if (fileExtension === 'docx') {
                            const result = await mammoth.extractRawText({ arrayBuffer: content });
                            textContent = result.value;
                        } else if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'webp'].includes(fileExtension || '')) {
                            setIsOcrProcessing(true); // Set OCR processing state
                            const { data: { text } } = await Tesseract.recognize(
                                file,
                                'eng', // You can add more languages if needed, e.g., 'eng+fra'
                                { logger: m => console.log(m) } // Optional: log OCR progress
                            );
                            textContent = `--- OCR from Image: ${file.name} ---\n${text}\n`;
                        }
                        else {
                            textContent = `Unsupported file type: ${file.name}. Could not process.`;
                        }
                        resolve(`--- START OF FILE: ${file.name} ---\n${textContent}\n--- END OF FILE: ${file.name} ---\n\n`);
                    } catch (err) {
                        const message = err instanceof Error ? err.message : String(err);
                        reject(new Error(`Failed to process ${file.name}: ${message}`));
                    }
                };
                reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
                // For image files, we can read as Data URL or keep as ArrayBuffer for Tesseract
                // Tesseract.js can handle File objects directly, so no need to readAsArrayBuffer for images
                if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'webp'].includes(fileExtension || '')) {
                    reader.readAsDataURL(file); // Read as Data URL for Tesseract
                } else {
                    reader.readAsArrayBuffer(file);
                }
            });
        }));
        setFileData(fileContents.join(''));
    } catch (err) {
        const message = err instanceof Error ? err.message : "An unknown error occurred during file processing.";
        console.error(err);
        setFileError(message);
        setFileData('');
    } finally {
        setIsProcessingFiles(false);
        setIsOcrProcessing(false); // Reset OCR processing state
    }
  }, [setFileData]);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); if (!isDragging) setIsDragging(true); };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
      e.dataTransfer.clearData();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };
  
  const handleClearFiles = () => {
    setFiles([]);
    setFileData('');
    setFileError(null);
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  const handleSignIn = () => {
    if (tokenClient) {
      // By prompting for 'select_account', we ensure the user can always choose
      // which Google account to use. This avoids issues with a sticky default
      // account and is less likely to cause policy errors than also prompting for 'consent'.
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    }
  };

  const handleSignOut = () => {
      const token = gapi.client.getToken();
      if (token) {
          google.accounts.oauth2.revoke(token.access_token, () => {});
          gapi.client.setToken(null);
      }
      setUser(null);
      handleDisconnectSheet();
  };

  const handleConnectSheet = useCallback(async () => {
      const spreadsheetId = extractSheetIdFromUrl(sheetUrl);
      if (!spreadsheetId) {
          setSheetError('URL de Google Sheet invalide. Veuillez coller l\'URL complète depuis votre navigateur.');
          return;
      }
      
      setIsConnectingSheet(true);
      setSheetError(null);

      try {
          // 1. Get sheet metadata to find names and title
          const metaResponse = await gapi.client.sheets.spreadsheets.get({ spreadsheetId });
          const firstSheetName = metaResponse.result.sheets[0]?.properties?.title;
          const spreadSheetTitle = metaResponse.result.properties.title;


          if (!firstSheetName) {
              throw new Error("Impossible de trouver des feuilles dans ce classeur.");
          }

          // 2. Get all values from the first sheet
          const dataResponse = await gapi.client.sheets.spreadsheets.values.get({
              spreadsheetId,
              range: firstSheetName, // Fetch the entire sheet
          });

          const values = dataResponse.result.values;
          if (!values || values.length === 0) {
              setSheetData('', spreadSheetTitle);
          } else {
              const csvText = arrayToCsv(values);
              setSheetData(csvText, spreadSheetTitle);
          }
          localStorage.setItem('googleSheetUrl', sheetUrl);
      } catch (err: any) {
          console.error(err);
          let message = 'Une erreur inconnue est survenue lors de la récupération de la feuille.';
          if (err.result?.error?.message) {
              message = `Erreur API: ${err.result.error.message}`;
          } else if (err.message) {
              message = err.message;
          }
          setSheetError(message);
          setSheetData('', '');
      } finally {
          setIsConnectingSheet(false);
      }
  }, [sheetUrl, setSheetData]);

  const handleDisconnectSheet = () => {
      setSheetData('', '');
      setSheetError(null);
      // Do not clear sheetUrl, user might want to reconnect
  };
  
  return (
    <>
      <div className="bg-gray-800 p-6 rounded-2xl shadow-lg flex flex-col space-y-6">
        {/* === FILE UPLOAD SECTION === */}
        <div className="flex flex-col flex-grow min-h-[15rem]">
          <h2 className="text-xl font-bold mb-4 text-cyan-400 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Téléverser des fichiers
          </h2>
          <div className="flex-grow flex flex-col">
            <div onDragEnter={isWebhookActive ? undefined : handleDragEnter} onDragLeave={isWebhookActive ? undefined : handleDragLeave} onDragOver={isWebhookActive ? undefined : handleDragOver} onDrop={isWebhookActive ? undefined : handleDrop} className={`w-full h-full border-2 border-dashed ${isDragging && !isWebhookActive ? 'border-cyan-400 bg-gray-700/50' : 'border-gray-600'} rounded-lg flex flex-col items-center justify-center text-center p-4 transition-colors duration-300 ${isWebhookActive ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`} onClick={() => !isWebhookActive && document.getElementById('file-upload')?.click()}>
              <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".csv,.txt,.tsv,.xlsx,.xls,.pdf,.docx,.png,.jpg,.jpeg,.gif,.bmp,.tiff,.webp" multiple disabled={isWebhookActive} />
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              {isWebhookActive ? (
                <p className="text-gray-400 font-semibold">Téléversement de fichiers désactivé (Webhook actif)</p>
              ) : (
                <>
                  <p className="text-gray-400 font-semibold"><span className="text-cyan-400">Téléversez des fichiers</span> ou glissez-déposez</p>
                  <p className="text-xs text-gray-500 mt-1">CSV, Excel, PDF, Word, Images, etc.</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Processing/Error messages for file upload */}
        {(isProcessingFiles || fileError) && (
          <div className="text-center w-full mt-4">
            {isProcessingFiles && !isOcrProcessing && <div className="text-cyan-400 flex items-center justify-center"><svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Traitement...</div>}
            {isOcrProcessing && <div className="text-cyan-400 flex items-center justify-center"><svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Lecture d'image (OCR)...</div>}
            {fileError && <div className="mt-4 text-red-400 text-sm bg-red-900/50 p-3 rounded-md"><p className="font-bold">Erreur</p><p>{fileError}</p></div>}
          </div>
        )}

        {/* === LOCAL FILES CONTEXT SECTION === */}
        {files.length > 0 && (
          <div className="flex flex-col mt-6">
            <h2 className="text-xl font-bold mb-4 text-cyan-400 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              Contexte: Fichiers locaux ({files.length})
            </h2>
            <div className="space-y-2 overflow-y-auto max-h-48 pr-2">
              {files.map(file => (
                <div key={file.name + '-' + file.size} className="flex items-center justify-between bg-gray-700/50 p-2 rounded-md text-sm">
                  <span className="truncate text-gray-300 pr-2">{file.name}</span>
                  <span className="flex-shrink-0 ml-2 text-gray-500">{Math.round(file.size / 1024)} KB</span>
                </div>
              ))}
            </div>
            <button onClick={handleClearFiles} disabled={isProcessingFiles || isWebhookActive} className="mt-6 w-full bg-red-600 text-white rounded-full py-2 px-6 hover:bg-red-500 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed">Supprimer les fichiers</button>
          </div>
        )}

        <div className="border-t border-gray-700/50 mt-6"></div>

        {/* === GOOGLE SHEET SECTION === */}
        {isGoogleSheetIntegrationEnabled ? (
          <div className="flex flex-col">
            <h2 className="text-xl font-bold mb-4 text-cyan-400 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
              Connecter une Google Sheet
            </h2>
            <div className="space-y-4">
              <GoogleAuth isSignedIn={isSignedIn} user={user} onSignIn={handleSignIn} onSignOut={handleSignOut} isReady={gisReady} />
              {isSignedIn && (
                sheetTitle ? (
                  <div className="bg-gray-700/50 p-3 rounded-md text-sm text-gray-300 space-y-3">
                     <div>
                        <p className="truncate font-semibold text-white">{sheetTitle || 'Feuille connectée'}</p>
                        <p className="truncate text-xs text-gray-400">{sheetUrl}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={handleConnectSheet} disabled={isConnectingSheet} className="flex-1 bg-cyan-600 text-white rounded-full py-1.5 px-4 text-xs hover:bg-cyan-500 transition-all disabled:bg-gray-600">{isConnectingSheet ? 'Sync...' : 'Sync'}</button>
                      <button onClick={handleDisconnectSheet} className="flex-1 bg-gray-600 text-white rounded-full py-1.5 px-4 text-xs hover:bg-gray-500 transition-all">Déconnecter</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                      <div className="relative">
                          <input
                              type="url"
                              value={sheetUrl}
                              onChange={(e) => setSheetUrl(e.target.value)}
                              placeholder='Coller l`URL de la Google Sheet...'
                              className="w-full bg-gray-900 border border-gray-700 rounded-full py-2 px-4 text-gray-300 focus:ring-2 focus:ring-cyan-500 transition-all"
                              disabled={isConnectingSheet}
                          />
                          <button onClick={() => setIsHelpModalOpen(true)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-cyan-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                          </button>
                      </div>
                    <button onClick={handleConnectSheet} disabled={isConnectingSheet || !sheetUrl} className="w-full bg-cyan-600 text-white rounded-full py-2 px-6 hover:bg-cyan-500 transition-all disabled:bg-gray-600 disabled:cursor-not-allowed">
                      {isConnectingSheet ? 'Connexion...' : 'Connecter la feuille'}
                    </button>
                  </div>
                )
              )}
              {sheetError && <div className="mt-2 text-red-400 text-sm bg-red-900/50 p-3 rounded-md"><p className="font-bold">Erreur de Connexion</p><p>{sheetError}</p></div>}
            </div>
          </div>
        ) : (
            <div className="flex flex-col">
                <h2 className="text-xl font-bold mb-4 text-gray-500 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                    Connecter une Google Sheet
                </h2>
                <div className="bg-gray-900/50 p-4 rounded-lg text-sm text-gray-400 border border-gray-700">
                    <p className="font-semibold text-gray-300">Fonctionnalité indisponible</p>
                    <p className="mt-1">L'intégration avec Google Sheets n'est pas configurée pour cet environnement. Les clés API requises sont manquantes.</p>
                </div>
            </div>
        )}
      </div>
      {isHelpModalOpen && <GoogleSheetHelpModal onClose={() => setIsHelpModalOpen(false)} />}
    </>
  );
};

export default DataSourceInput;
