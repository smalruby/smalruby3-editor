import {createRoot} from 'react-dom/client';
import App from './components/app.jsx';

const container = document.createElement('div');
document.body.appendChild(container);
createRoot(container).render(<App />);
