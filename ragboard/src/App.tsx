import React from 'react';
import { BoardCanvas } from './components/BoardCanvas';
import { AuthProvider } from './contexts/AuthContext';
import { AbilityProvider } from './contexts/AbilityContext';
import '@xyflow/react/dist/style.css';

function App() {
  // All fixes have been applied - v2
  return (
    <AuthProvider>
      <AbilityProvider>
        <div className="w-full h-screen">
          <BoardCanvas />
        </div>
      </AbilityProvider>
    </AuthProvider>
  );
}

export default App;