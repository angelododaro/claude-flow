import React from 'react';
import { BoardCanvas } from './components/BoardCanvas';
import '@xyflow/react/dist/style.css';

function App() {
  // All fixes have been applied - v2
  return (
    <div className="w-full h-screen">
      <BoardCanvas />
    </div>
  );
}

export default App;