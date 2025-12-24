import React, { useEffect, useState } from 'react'
import Input from './Input';
import sendData from '../util/sendData';
import { useNavigate } from 'react-router-dom';

const searchUsers = (search="", users=[]) => {
  const s = search.trim().toLowerCase();
  return users.filter(u => {
    if (u.username.toLowerCase().includes(s)) return true;
    if (u.usernameDecoration.prefix.toLowerCase().includes(s)) return true;
    return false;
  });
}

// Logged in
const LoggedInAdmin = ({style, user, users, setUsers, ...props}) => {
  const navigate = useNavigate();

  const [searchValue, setSearchValue] = useState("");
  const [warnValue, setWarnValue] = useState("");
  const [prefixValue, setPrefixValue] = useState("");
  const [prefixColorValue, setPrefixColorValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  

  const [editPerson, setEditPerson] = useState(null);

  const setPerson = (newPerson) => {
    const idx = users.findIndex(u => u._id === newPerson._id);
    const newUsers = JSON.parse(JSON.stringify(users));
    newUsers[idx] = newPerson;
    setUsers(newUsers);
    if (editPerson._id === newPerson._id) setEditPerson(newPerson);
  }

  const clickedPerson = (person) => {
    setEditPerson(person);
    setPrefixValue(person.usernameDecoration.prefix);
    setPrefixColorValue(person.usernameDecoration.prefixColor);
  }

  const submitWarn = async () => {
    console.log("submit warn");
  }
  const submitPrefix = async () => {
    const response = await sendData("/admin/assignprefix", {userId: editPerson._id, value: prefixValue,});
    if (response.status !== "success") {
      console.log(response.message);
      return;
    }
    const newPerson = {...editPerson, usernameDecoration: {...editPerson.usernameDecoration, prefix: prefixValue}};
    setPerson(newPerson);
    window.alert("Successful");
  }
  const submitPrefixColor = async () => {
    const response = await sendData("/admin/assignprefixcolor", {userId: editPerson._id, value: prefixColorValue,});
    if (response.status !== "success") {
      console.log(response.message);
      return;
    }
    const newPerson = {...editPerson, usernameDecoration: {...editPerson.usernameDecoration, prefixColor: prefixColorValue}};
    setPerson(newPerson);
    window.alert("Successful");
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

  const assignPremium = async (value = false) => {
    const response = await sendData("/admin/assignpremium", {userId: editPerson._id, value,});
    if (response.status !== "success") {
      console.log(response.message);
      return;
    }
    const newPerson = {...editPerson, premium: value};
    setPerson(newPerson);
    window.alert("Successful");
  }

  const assignFreeze = async (value = false) => {
    const response = await sendData("/admin/assignfreeze", {userId: editPerson._id, value,});
    if (response.status !== "success") {
      console.log(response.message);
      return;
    }
    const newPerson = {...editPerson, trouble: {...editPerson.trouble, frozen: value}};
    setPerson(newPerson);
    window.alert("Successful");
  }

  const addCredit = async () => {
    const response = await sendData("/admin/addaicredit", {userId: editPerson._id,});
    if (response.status !== "success") {
      console.log(response.message);
      return;
    }
    const newPerson = {...editPerson, extraDetails: {...editPerson.extraDetails, ai: {...editPerson.extraDetails.ai, image: {...editPerson.extraDetails.ai.image, credits: editPerson.extraDetails.ai.image.credits + 1}}}};
    setPerson(newPerson);
    window.alert("Successful");
    
  }
 

  return (
    <div className='Admin' style={{width: "100%"}} {...props}>

      {editPerson && (
        <div style={{position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", padding: "2vh", display: "flex", flexDirection: "column", minHeight: 300, width: 200, backgroundColor: "#3f3f3fff", cursor: "pointer"}}>
          <button onClick={() => setEditPerson(null)}>close</button>
          <div style={{marginTop: '1vh'}}></div>
          <h2>{editPerson.username}</h2>
          <h4>{editPerson.friends.length} friend{editPerson.friends.length===1 ? "":"s"}</h4>
          <h4>{editPerson.extraDetails.ai.image.used} AI images used</h4>
          <div style={{marginTop: '1vh'}}></div>
          <button onClick={addCredit}>Add 1 Credit</button>
          <div style={{marginTop: '1vh'}}></div>
          <label>WARN - soon</label>
          <input value={warnValue} onInput={(e) => setWarnValue(e.target.value)} />
          {warnValue.length > 0 && (<button onClick={submitWarn}>Submit</button>)}
          <div style={{marginTop: '1vh'}}></div>
          <label>Prefix</label>
          <input value={prefixValue} onInput={(e) => setPrefixValue(e.target.value)} />
          {editPerson.usernameDecoration?.prefix !== prefixValue && (<button onClick={submitPrefix}>Submit</button>)}
          <div style={{marginTop: '1vh'}}></div>
          <label>Prefix Color</label>
          <input value={prefixColorValue} type='color' onInput={(e) => setPrefixColorValue(e.target.value)} />
          {editPerson.usernameDecoration?.prefixColor !== prefixColorValue && (<button onClick={submitPrefixColor}>Submit</button>)}
          <div style={{marginTop: '1vh'}}></div>
          <label>Set password</label>
          <input value={passwordValue} onInput={(e) => setPasswordValue(e.target.value)} />
          {passwordValue.length > 0 && (<button onClick={submitPassword}>Submit</button>)}
          <div style={{marginTop: '1vh'}}></div>
          <button onClick={() => editPerson.premium ? assignPremium(false) : assignPremium(true)}>{editPerson.premium ? "Revoke Premium" : "Grant Premium"}</button>
          <div style={{marginTop: '1vh'}}></div>
          <button onClick={() => editPerson.trouble.frozen ? assignFreeze(false) : assignFreeze(true)}>{editPerson.trouble.frozen ? "Unfreeze" : "Freeze Account"}</button>
        </div>
      )}

      <h1>Admin</h1>
      <div className='button' onClick={() => navigate('/dashboard')} style={{marginTop: 5, marginBottom: 5}}>
          Go to Dashboard
      </div>
      <input value={searchValue} onInput={(e) => setSearchValue(e.target.value)} />
      <div style={{backgroundColor: "#444444ff", borderRadius: "1vh", padding: "2vh", width: "80%", marginTop: 20 }}>
        <div style={{padding: 10, marginBottom: 5, cursor: "pointer", width: "100%", fontSize: "1.4vh"}}>
          All Users:
        </div>
        {searchUsers(searchValue, users).map(person => (
          <div onClick={() => clickedPerson(person)} key={person._id} style={{padding: 10, borderTop: "2px solid grey", marginBottom: 5, cursor: "pointer", width: "100%", fontSize: "2vh" }}>
            {person.username}
          </div>
        ))}
      </div>
      
    </div>
  )
}



// Admin login
const Admin = () => {

  const [user, setUser] = useState(null);
  const [users, setUsers] = useState(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [errorMessage, setErrorMessage] = useState("");

  const checkAuth = async () => {
      const response = await sendData("/admin", {});
      if (response.status !== "success") {
        setErrorMessage(response.message);
        return;
      }
      console.log(response);
      setUsers(response.users);
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
    console.log(response);
    setUsers(response.users);
    setUser(response.user);
    
  }

  return user ? (
    // Admin dashboard for user
    <LoggedInAdmin user={user} users={users} setUsers={setUsers} />
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