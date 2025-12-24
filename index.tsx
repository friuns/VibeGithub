import { render } from 'solid-js/web';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

render(() => <App />, rootElement);