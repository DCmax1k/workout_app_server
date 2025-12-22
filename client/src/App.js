import {BrowserRouter as Router, Routes, Route} from 'react-router-dom';
import Index from './components/Index';
import Admin from './components/Admin';
import './App.css';
import LoginPage from './components/LoginPage';

function App() {
  return (
    <Router>
      <div className="App">
        
        <Routes>
          <Route path='/' element={<Index />} />
          <Route path='/admin' element={<Admin />} />
          <Route path='/login' element={<LoginPage />} />
        </Routes>
      
      </div>

    </Router>
    
  );
}

export default App;
