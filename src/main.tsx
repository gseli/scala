import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installKeyboardInput } from './input/keyboard';
import { inputHub } from './midi/inputHub';
import './styles.css';

installKeyboardInput();
void inputHub.init();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
