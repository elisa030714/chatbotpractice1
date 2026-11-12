import React from 'react';
import Chatbot from './components/Chatbot';
import './App.css';

export const App: React.FC = () => {
  return (
    <main className="app-main">
      <Chatbot />
    </main>
  );
};

export default App;
