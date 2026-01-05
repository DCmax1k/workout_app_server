import React, { useEffect, useState } from 'react'
import sendData from '../util/sendData';
import { useNavigate } from 'react-router-dom';
import StripeDisplay from './StripeDisplay';

export default function Dashboard() {
    const navigate = useNavigate();

    const [info, setInfo] = useState(null);

    useEffect(() => {
        // Check auth
        const checkAuth = async () => {
            // for testing
            //return setInfo(JSON.parse(`{"recentActivity":null,"dbId":"690eaddde44f134e30e11257","username":"test","name":"","email":"test@gmail.com","rank":"admin","premium":false,"friendRequests":[],"friendsAdded":[],"friends":[{"_id":"690295af9feed1676b9c407f","username":"DCmax1k","usernameDecoration":{"prefix":"LOCAL","prefixColor":"#ffe224"},"profileImg":{"url":"https://res.cloudinary.com/dlqj2rrlv/image/upload/v1741646278/profileImages/v2gdzso0hlhlpqpmcc48.jpg","public_id":""},"premium":true,"pastWorkoutsLength":10}],"subscriptions":[],"profileImg":{"url":"https://res.cloudinary.com/dxpmmy0ig/image/upload/v1765248986/profileImages/tpumbvjyhxxfhbnsn8jk.jpg","public_id":"profileImages/tpumbvjyhxxfhbnsn8jk"},"trouble":{"bans":[],"frozen":false},"googleId":"","appleId":"","facebookId":"","usernameDecoration":{"prefix":"","prefixColor":"#000000","description":"Or description here"},"extraDetails":{"ai":{"image":{"used":32,"lastReset":1764393189879,"credits":2},"foodText":{"credits":27,"lastReset":1764393189879,"used":null}}},"premiumSubscription":{"service":"stripe","stripe":{"customerId":"cus_TeYbmQy6HC0ToX","subscriptionId":null}}}`));

            const authResponse = await sendData('/auth', {});
            if (authResponse.status !== "success") {
                console.log("Error: ", authResponse.message);
                navigate('/login');
                return;
            }
            const {userInfo, fullLocalUser} = authResponse;
            console.log(JSON.stringify({...userInfo, recentActivity: null}));
            setInfo(userInfo);
        }
        checkAuth();
    }, [])

    const logout = async () => {
        await sendData('/login/logout', {});
        navigate('/login');
    }

    console.log(info);

  return info ? (
    <div className='Dashboard'>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
             <div className='username'>
                <img src={info.profileImg.url || "/images/icons/profileIcon.png"} />
                <h3 style={{color: info.premium ? "#94A7F3" : "white"}}>{info.username}</h3>
            </div>
            {info.rank === 'admin' && (
                <div className='logout' style={{backgroundColor: "red"}} onClick={() => navigate('/admin')}>
                    ADMIN
                </div>
            )}
            <div className='logout' onClick={logout}>
                Log out
            </div>
        </div>

        <StripeDisplay info={info} />




        
    </div>
  ) : (
    <div>Loading...</div>
  )
}
