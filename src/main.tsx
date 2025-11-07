import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import setupAxiosInterceptors from './config/api';

// 初始化axios拦截器
setupAxiosInterceptors();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
)