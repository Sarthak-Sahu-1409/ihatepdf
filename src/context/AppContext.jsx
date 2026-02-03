import { createContext, useContext, useReducer } from 'react';

const AppContext = createContext();

const initialState = {
  files: [],
  processing: false,
  progress: 0,
  error: null,
  currentTool: null
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_FILES':
      return { ...state, files: action.payload };
    case 'SET_PROCESSING':
      return { ...state, processing: action.payload };
    case 'SET_PROGRESS':
      return { ...state, progress: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_CURRENT_TOOL':
      return { ...state, currentTool: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);