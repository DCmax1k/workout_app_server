import React, { useEffect, useState } from 'react'
import Input from './Input';
import sendData from '../util/sendData';

// Logged in
const LoggedInAdmin = ({style, user, ...props}) => {

  const [searchValue, setSearchValue] = useState("");
  const [warnValue, setWarnValue] = useState("");
  const [prefixValue, setPrefixValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");

  const [searchedUsers, setSearchedUsers] = useState([]);
  

  const [editPerson, setEditPerson] = useState(null);

  const handleSearch = async (e) => {
    const search = e.target.value;
    setSearchValue(search);
    if (!search) return;
    const response = await sendData("/admin/searchusers", {search: search, username: user.username});
    if (response.status !== "success") {
      console.log(response.error);
      return;
    }
    setSearchedUsers(response.users);
  }

  const clickedPerson = (person) => {
    setEditPerson(person);
  }

  const submitWarn = async () => {
    console.log("submit warn");
  }
  const submitPrefix = async () => {
    console.log("submit prefix");
  }
  const submitPassword = async () => {
    const response = await sendData("/admin/assignpassword", {userId: editPerson._id, password: passwordValue});
    if (response.status !== "success") {
      console.log(response.message);
      return;
    }
    setPasswordValue("");
    window.alert("Successful");
  }
 

  return (
    <div className='Admin' {...props}>

      {editPerson && (
        <div style={{position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", padding: "2vh", display: "flex", flexDirection: "column", minHeight: 300, width: 200, backgroundColor: "#3f3f3fff", cursor: "pointer"}}>
          <button onClick={() => setEditPerson(null)}>close</button>
          <h2>{editPerson.username}</h2>
          <label>WARN</label>
          <input value={warnValue} onInput={(e) => setWarnValue(e.target.value)} />
          {warnValue.length > 0 && (<button onClick={submitWarn}>Submit</button>)}
          <label>Prefix</label>
          <input value={prefixValue} onInput={(e) => setPrefixValue(e.target.value)} />
          {prefixValue.length > 0 && (<button onClick={submitPrefix}>Submit</button>)}
          <label>Set password</label>
          <input value={passwordValue} onInput={(e) => setPasswordValue(e.target.value)} />
          {passwordValue.length > 0 && (<button onClick={submitPassword}>Submit</button>)}
        </div>
      )}

      <h1>Admin</h1>
      <input value={searchValue} onInput={handleSearch} />
      {searchedUsers.map(person => (
        <div onClick={() => clickedPerson(person)} key={person._id} style={{padding: 10, margin: 10, border: "2px solid black", cursor: "pointer"}}>
          {person.username}
        </div>
      ))}
    </div>
  )
}



// Admin login
const Admin = () => {

  const [user, setUser] = useState(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [errorMessage, setErrorMessage] = useState("");

  const checkAuth = async () => {
      const response = await sendData("/admin", {});
      if (response.status !== "success") {
        setErrorMessage(response.message);
        return;
      }
      setUser(response.user);
    }

  useEffect(() => {
    checkAuth();

  }, []);

  const submitData = async () => {
    if (!username || !password) return;
    const response = await sendData("/admin/login", {username, password});
    if (response.status !== "success") {
        setErrorMessage(response.message);
        return;
    }
    setUser(response.user);
  }

  return user ? (
    // Admin dashboard for user
    <LoggedInAdmin user={user} />
  ) : (
    // Show login for admin
    <div className="Login">
        <h1>Log in</h1>
        <div className='hr' style={{width: "calc(100px + 40%)"}}></div>
        <Input onInput={setUsername} className="indexLogin" placeholder={"Username"} type="text" />
        <Input onInput={setPassword} className="indexLogin" placeholder={"Password"} type="password" enter={submitData} />
        <div onClick={submitData} className='btn' style={{backgroundColor: "#FF8CE5", color: "#FFFFFF"}}>Login</div>
        {errorMessage.length > 0 && <div style={{marginTop: "3vh", marginBottom: 5, fontSize: "1.7vh"}}>{errorMessage}</div>}
    </div>
  )
}

export default Admin