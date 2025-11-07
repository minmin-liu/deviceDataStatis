import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import DeviceStatsPage from './pages/DeviceStatsPage'
import {getFullPath}  from './config/constants';

// 私有路由组件
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const token = sessionStorage.getItem('token')
  
  return token ? (
    <>{children}</>
  ) : (
    <Navigate to={getFullPath('login')} replace />
  )
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path={getFullPath('login')} element={<LoginPage />} />
        <Route 
          path={getFullPath('manage')} 
          element={
            <PrivateRoute>
                <DeviceStatsPage />
              </PrivateRoute>
          } 
        />
        <Route path={getFullPath('')} element={<Navigate to={getFullPath('login')} replace />} />
        <Route path="*" element={<Navigate to={getFullPath('login')} replace />} />
      </Routes>
    </Router>
  )
}

export default App