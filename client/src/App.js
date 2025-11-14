import {BrowserRouter as Router, Routes, Route} from 'react-router-dom';
import Index from './components/Index';
import Admin from './components/Admin';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        
        <Routes>
          <Route path='/' element={<Index />} />
          <Route path='/admin' element={<Admin />} />
        </Routes>
      
      </div>

    </Router>
    
  );
}

export default App;
