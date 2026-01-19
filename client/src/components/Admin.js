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
const LoggedInAdmin = ({style, user, users, setUsers, supportTickets, setSupportTickets, ...props}) => {
  const navigate = useNavigate();

  const [searchValue, setSearchValue] = useState("");
  const [warnValue, setWarnValue] = useState("");
  const [prefixValue, setPrefixValue] = useState("");
  const [prefixColorValue, setPrefixColorValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");

  const [page, setPage] = useState(0); // 0 users, 1 support tickets
  

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

  const deleteAccount = async () => {
    const response = await sendData('/admin/deleteaccount', {userId: editPerson._id});
    if (response.status !== "success") {
      console.log(response.message);
      return;
    }
    const newUsers = users.filter(u => u._id !== editPerson._id)
    setUsers(newUsers);
  }
  const requestDeleteAccount = () => {
    const confirmation = window.confirm("Delete account named: " + editPerson.username);
    if (confirmation) {
      deleteAccount();
    }
  }

  const setDismiss = async (value, ticketId) => {
    const response = await sendData("/admin/dismissticket", {ticketId, value});
    if (response.status !== "success") {
      console.log(response.message);
      return;
    }
    const newTickets = supportTickets.map(ticket => {
      if (ticket._id === ticketId) {
        return {...ticket, dismissed: value};
      }
      return ticket;
    });
    setSupportTickets(newTickets);
  }
 

  return (
    <div className='Admin' style={{width: "100%"}} {...props}>

      {editPerson && (
        <div style={{position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", padding: "2vh", display: "flex", flexDirection: "column", minHeight: 300, width: 200, backgroundColor: "#3f3f3fff", cursor: "pointer", zIndex: 5}}>
          <button onClick={() => setEditPerson(null)}>close</button>
          <div style={{marginTop: '1vh'}}></div>
          <h2>{editPerson.username}</h2>
          <h4>{editPerson.friends.length} friend{editPerson.friends.length===1 ? "":"s"}</h4>
          <h4>{editPerson.extraDetails.ai.image.used} AI images used</h4>
          <h4>{editPerson.extraDetails.ai.foodText?.used ?? 0} AI food text used</h4>
          <div style={{marginTop: '1vh'}}></div>
          <button onClick={addCredit}>Add 1 image Credit</button>
          <div style={{marginTop: '1vh'}}></div>
          <label>WARN - coming soon</label>
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
          <div style={{marginTop: '1vh'}}></div>
          <button style={{backgroundColor: "red"}} onClick={requestDeleteAccount}>Delete Account</button>
        </div>
      )}

      <h1>Admin</h1>
      <div className='button' onClick={() => navigate('/dashboard')} style={{marginTop: 5, marginBottom: 5}}>
          Go to Dashboard
      </div>
      
      <input value={searchValue} onInput={(e) => setSearchValue(e.target.value)} style={{outline: "none", border: "none", backgroundColor: "#b4b4b4ff", padding: 5, borderRadius: 5}} placeholder='Search user' />
      
      {page === 0 ? (
        <div className='button' onClick={() => {setPage(1)}} style={{marginTop: 10, marginBottom: 5, alignSelf: "flex-start"}}>
          New Support Tickets: {supportTickets.filter(t => !t.dismissed).length}
        </div>
      ) : page === 1 ? (
        <div className='button' onClick={() => {setPage(0)}} style={{marginTop: 10, marginBottom: 5, alignSelf: "flex-start"}}>
            Show Users: {users.length}
        </div>
      ) : null}
      
      {page === 0 ? (
        <div className='scrollview' style={{backgroundColor: "#444444ff", borderRadius: "1vh", padding: "2vh", marginTop: 10 }}>
            <div style={{padding: 10, marginBottom: 5, cursor: "pointer", width: "100%", fontSize: "1.4vh"}}>
              All Users:
            </div>
            {searchUsers(searchValue, users).sort((a, b) => a.dateJoined - b.dateJoined).map((person, i) => (
              <div onClick={() => clickedPerson(person)} key={person._id} style={{padding: 10, borderTop: "2px solid grey", marginBottom: 5, cursor: "pointer", width: "100%", fontSize: "2vh", display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}>
                <div style={{height: 40, width: 40, borderRadius: 9999, overflow: 'hidden', position: "relative"}}>
                  <img style={{height: "100%", width: "100%", objectFit: "contain"}} src={person.profileImg.url || "/images/icons/profileIcon.png"} alt='profile img' />
                  <div style={{position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, backgroundColor: "#00000080", display: "flex", justifyContent: "center", alignItems: "center", color: "white", textShadow: "0 0 3px black"}}>
                    {1+i}
                  </div>
                  
                </div>
                
                <p style={{color: person.premium ? "#94A7F3" : "white"}}>{person.username}</p>
              </div>
            ))}
        </div>
      ) : page === 1 ? (
        <div className='scrollview' style={{backgroundColor: "#444444ff", borderRadius: "1vh", padding: "2vh", marginTop: 10 }}>
            <div style={{padding: 10, marginBottom: 5, width: "100%", fontSize: "1.4vh"}}>
              All Support Tickets:
            </div>
            {supportTickets.map((ticket, i) => {
              const backgroundColor = ticket.dismissed ? "transparent" : ticket.type === "reportabug" ? "#DB545680" : ticket.type === 'requestfeature' ? "#B660BA80" : ticket.type === 'generalsupport' ? "#2ee36a80" : "transparent";
              const title = ticket.type === "reportabug" ? "Reported Bug" : ticket.type === 'requestfeature' ? "Feature Idea" : ticket.type === 'generalsupport' ? "General Support" : "transparent";
              let user = {username: "user"};
              if (ticket.userId) {
                user = users.find(u => u._id === ticket.userId);
              }
              return (
                <div key={ticket._id} style={{padding: 10, borderTop: "2px solid grey", marginBottom: 5, width: "100%", fontSize: "2vh", display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <div style={{padding: 20, borderRadius: 10, display: "flex", flexDirection: "column", width: "100%", gap: 5, backgroundColor}}>
                    <p style={{fontSize: 15,}}>{title}</p>
                    <p style={{fontSize: 20,}}>{ticket.data.subject}</p>
                    <p style={{fontSize: 12, fontWeight: "300",}}>{ticket.data.message}</p>
                    <p style={{fontSize: 12, fontWeight: "300",}}>Post by: {user.username}</p>
                    <p style={{fontSize: 12, fontWeight: "300",}}>{new Date(ticket.timestamp).toLocaleDateString()}</p>
                    <button onClick={() => {setDismiss(!ticket.dismissed, ticket._id)}} style={{width: 100}}>{ticket.dismissed ? "Undismiss" : "Dismiss"}</button>
                  </div>
                </div>
              )
            })}
        </div>
      ) : null}
      
    </div>
  )
}



// Admin login
const Admin = () => {

  const [user, setUser] = useState(null);
  const [users, setUsers] = useState(null);
  const [supportTickets, setSupportTickets] = useState([]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [errorMessage, setErrorMessage] = useState("");

  const checkAuth = async () => {
      //const response = { "status": "success", "user": { "_id": "690eaddde44f134e30e11257", "username": "test", "usernameDecoration": { "prefix": "", "prefixColor": "#000000", "description": "Or description here" }, "profileImg": { "url": "", "public_id": "" }, "premium": false, "pastWorkoutsLength": 15 }, "users": [ { "profileImg": { "url": "", "public_id": "" }, "_id": "690295af9feed1676b9c407f", "username": "DCmax1k", "verifyEmailCode": "541400", "rank": "user", "premium": true, "friends": [ "690eaddde44f134e30e11257" ], "trouble": { "bans": [], "frozen": false }, "usernameDecoration": { "prefix": "LOCAL", "prefixColor": "#ffe224" }, "extraDetails": { "ai": { "image": { "used": 0, "credits": 6, "lastReset": 1766118872737 } }, "preferences": { "liftUnit": "imperial", "heightUnit": "imperial", "distanceUnit": "imperial", "systemTheme": "dark", "restTimerAmount": 120, "workouts": true, "achievements": true } } }, { "profileImg": { "url": "https://res.cloudinary.com/dxpmmy0ig/image/upload/v1765248986/profileImages/tpumbvjyhxxfhbnsn8jk.jpg", "public_id": "profileImages/tpumbvjyhxxfhbnsn8jk" }, "_id": "690eaddde44f134e30e11257", "username": "test", "verifyEmailCode": "321311", "rank": "admin", "premium": false, "friends": [ "690295af9feed1676b9c407f" ], "trouble": { "bans": [], "frozen": false }, "usernameDecoration": { "prefix": "", "prefixColor": "#000000", "description": "Or description here" }, "extraDetails": { "ai": { "image": { "used": 41, "lastReset": 1764393189879, "credits": 6 }, "foodText": { "credits": 9, "lastReset": 1764393189879, "used": 18 } }, "preferences": { "liftUnit": "imperial", "heightUnit": "imperial", "distanceUnit": "imperial", "systemTheme": "dark", "restTimerAmount": 120, "workouts": false, "achievements": true } } } ], "supportTickets": [ { "_id": "695b08ab6836588399249d3e", "userId": "690295af9feed1676b9c407f", "email": "dylan@digitalcaldwell.com", "type": "generalsupport", "data": { "subject": "Generally speaking", "message": "this is a general message" }, "dismissed": false, "timestamp": "2026-01-05T00:41:15.875Z", "__v": 0 }, { "_id": "695b087a6836588399249d3c", "userId": "690295af9feed1676b9c407f", "email": "dylan@digitalcaldwell.com", "type": "requestfeature", "data": { "subject": "New feature bruh", "message": "Itd be sick if you did this" }, "dismissed": false, "timestamp": "2026-01-05T00:40:26.147Z", "__v": 0 }, { "_id": "695b0808144fa26e27dbb54f", "userId": "690295af9feed1676b9c407f", "email": "dylan@digitalcaldwell.com", "type": "reportabug", "data": { "subject": "Bug / Crash", "message": "This is a bug.\nCrazy bug that happened here" }, "dismissed": false, "timestamp": "2026-01-05T00:38:32.617Z", "__v": 0 } ] }
      const response = await sendData("/admin", {});
      if (response.status !== "success") {
        setErrorMessage(response.message);
        return;
      }
      console.log(response);
      setUsers(response.users);
      setUser(response.user);
      setSupportTickets(response.supportTickets);
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
    <LoggedInAdmin user={user} users={users} setUsers={setUsers} supportTickets={supportTickets} setSupportTickets={setSupportTickets} />
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