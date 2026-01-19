const SET_GOOGLE_DRIVE_FILE = 'googleDriveFile/SET_GOOGLE_DRIVE_FILE';
const CLEAR_GOOGLE_DRIVE_FILE = 'googleDriveFile/CLEAR_GOOGLE_DRIVE_FILE';

const initialState = {
    fileId: null,
    fileName: null,
    folderId: null,
    isGoogleDriveFile: false
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case SET_GOOGLE_DRIVE_FILE:
        return {
            fileId: action.fileId,
            fileName: action.fileName,
            folderId: action.folderId || null,
            isGoogleDriveFile: true
        };
    case CLEAR_GOOGLE_DRIVE_FILE:
        return initialState;
    default:
        return state;
    }
};

const setGoogleDriveFile = (fileId, fileName, folderId) => ({
    type: SET_GOOGLE_DRIVE_FILE,
    fileId: fileId,
    fileName: fileName,
    folderId: folderId
});

const clearGoogleDriveFile = () => ({
    type: CLEAR_GOOGLE_DRIVE_FILE
});

export {
    reducer as default,
    initialState as googleDriveFileInitialState,
    setGoogleDriveFile,
    clearGoogleDriveFile
};
