import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AppProvider } from './state/app';
import { PassportProvider } from './state/passport';
import { RunnerProvider } from './state/runner';
import './styles.css';
import './workspaces.css';
import './brand.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <PassportProvider>
          <RunnerProvider>
            <App />
          </RunnerProvider>
        </PassportProvider>
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
);
