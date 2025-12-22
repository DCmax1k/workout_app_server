import {BrowserRouter as Router, Routes, Route} from 'react-router-dom';
import Index from './components/Index';
import Admin from './components/Admin';
import './App.css';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';

function App() {
  return (
    <Router>
      <div className="App">
        
        <Routes>
          <Route path='/' element={<Index />} />
          <Route path='/admin' element={<Admin />} />
          <Route path='/login' element={<LoginPage />} />
          <Route path='/dashboard' element={<Dashboard />} />
        </Routes>
      
      </div>

    </Router>
    
  );
}

export default App;
