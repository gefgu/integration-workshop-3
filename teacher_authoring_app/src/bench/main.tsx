import React from 'react';
import ReactDOM from 'react-dom/client';
import '../styles.css';
import './bench.css';
import BenchApp from './BenchApp.tsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BenchApp />
  </React.StrictMode>
);
