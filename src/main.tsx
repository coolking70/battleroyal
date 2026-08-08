import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { loadAssetManifest } from './ui/assetManifestLoader';
import './ui/styles.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('找不到挂载节点 #root');
}
const rootContainer = container;

export async function bootstrap(): Promise<void> {
  await loadAssetManifest();
  createRoot(rootContainer).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
