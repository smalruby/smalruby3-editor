/**
 * Google Drive API Integration
 *
 * This module handles Google Drive authentication and file picking using:
 * - Google Identity Services for OAuth 2.0 authentication
 * - Google Picker API for file selection UI
 */

import {loadAllGoogleScripts} from './google-script-loader';

// OAuth 2.0 scopes
// Using 'drive.file' scope to allow:
// - Reading files selected by the user via Picker
// - Uploading new files to Google Drive
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

// Discovery docs for Google Drive API
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];

// Google API configuration (loaded from environment variables)
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const API_KEY = process.env.GOOGLE_API_KEY;

/**
 * GoogleDriveAPI class
 * Manages authentication and file operations with Google Drive
 */
class GoogleDriveAPI {
    constructor () {
        this.isInitialized = false;
        this.tokenClient = null;
        this.accessToken = null;
        this.pickerCallback = null;
    }

    /**
     * Initialize Google API and Identity Services
     * @returns {Promise<void>} Promise that resolves when initialization is complete
     */
    async initialize () {
        if (this.isInitialized) {
            return;
        }

        // Validate configuration
        if (!CLIENT_ID || !API_KEY) {
            throw new Error(
                'Google Drive API credentials not configured. ' +
                'Please set GOOGLE_CLIENT_ID and GOOGLE_API_KEY environment variables. ' +
                'See docs/google-drive-setup.md for setup instructions.'
            );
        }

        try {
            // Load Google scripts dynamically
            await loadAllGoogleScripts();

            // Initialize gapi client
            await new Promise((resolve, reject) => {
                window.gapi.load('client:picker', {
                    callback: resolve,
                    onerror: reject
                });
            });

            // Initialize gapi client with API key and discovery docs
            await window.gapi.client.init({
                apiKey: API_KEY,
                discoveryDocs: DISCOVERY_DOCS
            });

            // Initialize Google Identity Services token client
            this.tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: '' // Will be set dynamically when requesting access
            });

            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize Google Drive API:', error);
            throw new Error('Google Drive API initialization failed. Please check your configuration.');
        }
    }

    /**
     * Request access token
     * @returns {Promise<string>} Promise that resolves with access token
     */
    requestAccessToken () {
        return new Promise((resolve, reject) => {
            this.tokenClient.callback = response => {
                if (response.error) {
                    reject(new Error(`Authentication failed: ${response.error}`));
                    return;
                }
                this.accessToken = response.access_token;
                resolve(response.access_token);
            };

            // Check if user already has valid token
            if (this.accessToken && window.gapi.client.getToken()) {
                resolve(this.accessToken);
                return;
            }

            // Request new token
            this.tokenClient.requestAccessToken({prompt: ''});
        });
    }

    /**
     * Show Google Picker to select a file
     * @param {Function} callback - Called when user selects a file
     * @param {string} locale - Locale code (e.g., 'en', 'ja') for picker UI language
     * @param {string} title - Title for the picker dialog
     * @returns {Promise<void>} Promise that resolves when picker is shown
     */
    async showPicker (callback, locale = 'en', title = 'Select a Scratch 3.0 project (.sb3) from Google Drive') {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            // Request access token if not already available
            const token = await this.requestAccessToken();

            this.pickerCallback = callback;

            // Create DocsView with .sb3 query filter, starting from root
            const docsView = new window.google.picker.DocsView()
                .setIncludeFolders(true)
                .setMode(window.google.picker.DocsViewMode.LIST)
                .setQuery('.sb3')
                .setParent('root'); // Start from root folder for hierarchical navigation

            const picker = new window.google.picker.PickerBuilder()
                .addView(docsView)
                .addView(
                    new window.google.picker.DocsUploadView()
                        .setIncludeFolders(true)
                )
                .setOAuthToken(token)
                .setDeveloperKey(API_KEY)
                .setCallback(this.handlePickerResponse.bind(this))
                .setTitle(title)
                .setLocale(locale)
                .build();

            picker.setVisible(true);
        } catch (error) {
            console.error('Failed to show Google Picker:', error);
            throw error;
        }
    }

    /**
     * Handle picker response
     * @param {object} data - Picker response data
     */
    handlePickerResponse (data) {
        const action = data[window.google.picker.Response.ACTION];

        if (action === window.google.picker.Action.PICKED) {
            const doc = data[window.google.picker.Response.DOCUMENTS][0];
            const fileId = doc[window.google.picker.Document.ID];
            const fileName = doc[window.google.picker.Document.NAME];

            // Validate file type by extension (more reliable than MIME type for .sb3 files)
            if (!fileName.endsWith('.sb3')) {
                if (this.pickerCallback) {
                    this.pickerCallback({
                        error: 'Invalid file type. Please select a .sb3 file.'
                    });
                }
                return;
            }

            // Notify that file has been selected (before download starts)
            if (this.pickerCallback) {
                try {
                    this.pickerCallback({
                        selected: true,
                        fileName: fileName
                    });
                } catch (callbackError) {
                    console.error('[GoogleDriveAPI] Error in file selected callback:', callbackError);
                    // Continue with download even if callback fails
                }
            }

            // Download file
            this.downloadFile(fileId, fileName)
                .then(fileData => {
                    if (this.pickerCallback) {
                        // Wrap callback invocation in try-catch to prevent callback errors
                        // from being caught as download errors
                        try {
                            this.pickerCallback({
                                success: true,
                                fileId: fileId,
                                fileName: fileName,
                                fileData: fileData
                            });
                        } catch (callbackError) {
                            console.error(
                                '[GoogleDriveAPI] Error in picker callback (not a download error):',
                                callbackError
                            );
                            // Don't re-throw - this is a callback error, not a download error
                        }
                    }
                })
                .catch(error => {
                    console.error('[GoogleDriveAPI] Download error caught in handlePickerResponse:', {
                        error: error,
                        errorType: typeof error,
                        hasMessage: error && 'message' in error,
                        errorString: String(error)
                    });

                    if (this.pickerCallback) {
                        const errorMessage = error && error.message ? error.message : String(error);
                        try {
                            this.pickerCallback({
                                error: `Failed to download file: ${errorMessage}`
                            });
                        } catch (callbackError) {
                            console.error('[GoogleDriveAPI] Error in error callback:', callbackError);
                        }
                    }
                });
        } else if (action === window.google.picker.Action.CANCEL) {
            if (this.pickerCallback) {
                this.pickerCallback({
                    cancelled: true
                });
            }
        }
    }

    /**
     * Download file from Google Drive
     * @param {string} fileId - Google Drive file ID
     * @param {string} fileName - File name (for debugging)
     * @returns {Promise<ArrayBuffer>} Promise that resolves with file data as ArrayBuffer
     */
    async downloadFile (fileId, fileName) {
        try {
            const response = await window.gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });

            // Convert response to ArrayBuffer
            // gapi returns the file content as a string for binary files
            const binaryString = response.body;
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            return bytes.buffer;
        } catch (error) {
            console.error(`[GoogleDriveAPI] Download failed for ${fileName}:`, {
                error: error,
                errorType: typeof error,
                errorConstructor: error ? error.constructor.name : 'N/A',
                hasMessage: error && 'message' in error,
                message: error && error.message,
                hasStatus: error && 'status' in error,
                status: error && error.status,
                keys: error ? Object.keys(error) : []
            });
            throw error;
        }
    }

    /**
     * Show Google Picker to select a folder
     * @param {Function} callback - Called when user selects a folder
     * @param {string} locale - Locale code (e.g., 'en', 'ja') for picker UI language
     * @param {string} title - Title for the picker dialog
     * @returns {Promise<void>} Promise that resolves when picker is shown
     */
    async showFolderPicker (callback, locale = 'en', title = 'Select a folder in Google Drive') {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            // Request access token if not already available
            const token = await this.requestAccessToken();

            this.pickerCallback = callback;

            // Create DocsView for folders only, starting from root
            const docsView = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
                .setIncludeFolders(true)
                .setSelectFolderEnabled(true)
                .setParent('root'); // Start from root folder for hierarchical navigation

            const picker = new window.google.picker.PickerBuilder()
                .addView(docsView)
                .setOAuthToken(token)
                .setDeveloperKey(API_KEY)
                .setCallback(this.handleFolderPickerResponse.bind(this))
                .setTitle(title)
                .setLocale(locale)
                .build();

            picker.setVisible(true);
        } catch (error) {
            console.error('Failed to show Google Folder Picker:', error);
            throw error;
        }
    }

    /**
     * Handle folder picker response
     * @param {object} data - Picker response data
     */
    handleFolderPickerResponse (data) {
        const action = data[window.google.picker.Response.ACTION];

        if (action === window.google.picker.Action.PICKED) {
            const doc = data[window.google.picker.Response.DOCUMENTS][0];
            const folderId = doc[window.google.picker.Document.ID];
            const folderName = doc[window.google.picker.Document.NAME];

            if (this.pickerCallback) {
                try {
                    this.pickerCallback({
                        success: true,
                        folderId: folderId,
                        folderName: folderName
                    });
                } catch (callbackError) {
                    console.error('[GoogleDriveAPI] Error in folder picker callback:', callbackError);
                }
            }
        } else if (action === window.google.picker.Action.CANCEL) {
            if (this.pickerCallback) {
                this.pickerCallback({
                    cancelled: true
                });
            }
        }
    }

    /**
     * Upload file to Google Drive
     * @param {string} filename - File name
     * @param {Blob} fileData - File content as Blob
     * @param {string} folderId - Optional folder ID (null for My Drive root)
     * @returns {Promise<object>} Upload result with file ID and webViewLink
     */
    async uploadFile (filename, fileData, folderId = null) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            // Request access token if not already available
            await this.requestAccessToken();

            // Prepare metadata
            const metadata = {
                name: filename,
                mimeType: 'application/x.scratch.sb3'
            };

            // Add parent folder if specified
            if (folderId) {
                metadata.parents = [folderId];
            }

            // Create multipart request body
            const boundary = '-------314159265358979323846';
            const delimiter = `\r\n--${boundary}\r\n`;
            const closeDelimiter = `\r\n--${boundary}--`;

            // Convert blob to base64
            const reader = new FileReader();
            const base64Promise = new Promise((resolve, reject) => {
                reader.onloadend = () => {
                    const base64Data = reader.result.split(',')[1];
                    resolve(base64Data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(fileData);
            });

            const base64Data = await base64Promise;

            // Build multipart body
            const multipartRequestBody = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${
                JSON.stringify(metadata)
            }${delimiter}Content-Type: application/x.scratch.sb3\r\nContent-Transfer-Encoding: base64\r\n\r\n${
                base64Data
            }${closeDelimiter}`;

            // Upload file using gapi.client.request
            const response = await window.gapi.client.request({
                path: '/upload/drive/v3/files',
                method: 'POST',
                params: {
                    uploadType: 'multipart',
                    fields: 'id,name,webViewLink'
                },
                headers: {
                    'Content-Type': `multipart/related; boundary=${boundary}`
                },
                body: multipartRequestBody
            });

            console.log('[GoogleDriveAPI] File uploaded successfully:', response.result);
            return response.result;
        } catch (error) {
            console.error('[GoogleDriveAPI] Upload failed:', {
                error: error,
                errorType: typeof error,
                message: error && error.message,
                status: error && error.status
            });
            throw error;
        }
    }

    /**
     * Update existing file in Google Drive
     * @param {string} fileId - Google Drive file ID
     * @param {string} filename - File name
     * @param {Blob} fileData - File content as Blob
     * @returns {Promise<object>} Update result with file ID and webViewLink
     */
    async updateFile (fileId, filename, fileData) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            // Check if token is valid, if not, request new one
            const hasValidToken = this.accessToken && window.gapi.client.getToken();
            if (!hasValidToken) {
                await this.requestAccessToken();
            }

            // Prepare metadata
            const metadata = {
                name: filename,
                mimeType: 'application/x.scratch.sb3'
            };

            // Create multipart request body
            const boundary = '-------314159265358979323846';
            const delimiter = `\r\n--${boundary}\r\n`;
            const closeDelimiter = `\r\n--${boundary}--`;

            // Convert blob to base64
            const reader = new FileReader();
            const base64Promise = new Promise((resolve, reject) => {
                reader.onloadend = () => {
                    const base64Data = reader.result.split(',')[1];
                    resolve(base64Data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(fileData);
            });

            const base64Data = await base64Promise;

            // Build multipart body
            const multipartRequestBody = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${
                JSON.stringify(metadata)
            }${delimiter}Content-Type: application/x.scratch.sb3\r\nContent-Transfer-Encoding: base64\r\n\r\n${
                base64Data
            }${closeDelimiter}`;

            // Update file using gapi.client.request with PATCH method
            const response = await window.gapi.client.request({
                path: `/upload/drive/v3/files/${fileId}`,
                method: 'PATCH',
                params: {
                    uploadType: 'multipart',
                    fields: 'id,name,webViewLink'
                },
                headers: {
                    'Content-Type': `multipart/related; boundary=${boundary}`
                },
                body: multipartRequestBody
            });

            console.log('[GoogleDriveAPI] File updated successfully:', response.result);
            return response.result;
        } catch (error) {
            console.error('[GoogleDriveAPI] Update failed:', {
                error: error,
                errorType: typeof error,
                message: error && error.message,
                status: error && error.status
            });
            throw error;
        }
    }

    /**
     * Check if API is configured
     * @returns {boolean} True if API credentials are configured
     */
    static isConfigured () {
        return !!(CLIENT_ID && API_KEY);
    }
}

// Export singleton instance
export default new GoogleDriveAPI();
