import React, { useEffect, useState } from 'react'
import sendData from '../util/sendData';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check auth
    const checkAuth = async () => {
        const authResponse = await sendData('/auth', {});
        if (authResponse.status !== "success") {
            return;
        }
        navigate("/dashboard");
    }
    checkAuth();
  })

  const submit = async () => {
    if (!username || !password) return;
    setIsLoading(true);
    const response = await sendData('/login', ({ username, password, fromWeb: true }));
    if (response.status !== "success") {
        setIsLoading(false);
        console.log("Error: ", response.message);
        alert(response.message, false);
        return;
    };
    navigate('/dashboard');
  }

  return (
    <div className='LoginPage'>
        <h1>Login</h1>

        <input placeholder='Username or Email' type='text' value={username} onInput={e => setUsername(e.target.value)} />
        <input placeholder='Password' type='password'  value={password} onInput={e => setPassword(e.target.value)} />
        <div className='submit' onClick={submit}>
          {isLoading ? "Loading..." : "Submit"}
        </div>

        <div>
          Don't have an account? <a href='https://play.google.com/store/apps/details?id=com.caldwell.pumpedup' target='_blank' rel="noreferrer"> Get The App</a>
        </div>
    </div>
  )
}
