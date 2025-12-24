import { useState } from "react";
import sendData from "../util/sendData";

export default function StripeDisplay({info, ...props}) {

  const [subOpen, setSubOpen] = useState(0);

  const subs = [
    {
      id: 0,
      name: "12 Months",
      price: '3.78',
      //priceId: 'price_1Sh3NPGf9fWISIA5NP009I8j', // test
      priceId: 'price_1ShGIrGf9fWISIA5lffICEvO',
      percentOff: "45",
      tag: "BEST VALUE",
      desc: "Billed yearly as one payment of $45.36",
    },
    {
      id: 1,
      name: "6 Months",
      price: '4.81',
      //priceId: 'price_1Sh3ytGf9fWISIA5OAABwzkz', // test
      priceId: 'price_1ShGIlGf9fWISIA5ghAAZo7m',
      percentOff: "39",
      tag: "MOST POPULAR",
      desc: "$28.86 billed every 6 months",
    },
    {
      id: 2,
      name: "Monthly",
      price: '6.89',
      //priceId: 'price_1Sh42AGf9fWISIA5X6PycqPg', //test
      priceId: 'price_1ShGIZGf9fWISIA5Sp6Pf4XA',
      percentOff: "",
      tag: "",
      desc: "Billed $6.89 per month",
    }
  ]

  const handleSubscribe = async (pId) => {
    try {
      const response = await sendData("/stripe/create-checkout-session", {priceId: pId});
      if (response.status !== "success") {
        console.log("error session");
        return;
      }
      window.location.href = response.url;
    } catch(err) {
      console.error(err);
    }
  }

  const manageBilling = async () => {
    const response = await sendData('/stripe/managebilling');
    if (response.status !== "success") {
      return alert(response.message);
    }
    window.location.href = response.url;
  }

  const isSubscribed = !info.premium ? false : ( info.premiumSubscription['stripe']?.subscriptionId ) ? true : false; // Add apple and google checks when configured


  return (
    <div style={{width: "100%", marginTop: 30}} {...props}>

      {!isSubscribed && (<div style={{display: "flex", flexDirection: "column", gap: 10, flexWrap: "wrap"}}>

        {subs.map((sub, i) => {
              return (
                <div onClick={sub.id !== subOpen ? () => setSubOpen(sub.id) : null} key={sub.id} className={`subscription_card ${subOpen === sub.id ? "active":""}`}>
                  <div className="subTop">
                    <div className="subTopLeft">
                      {sub.tag && (<p style={{fontSize: 12, fontWeight: "400", color: "#979797"}}>{sub.tag} <span>{sub.percentOff}% off</span></p>)}
                      <p>{sub.name}</p>
                    </div>
                    <div className="subTopRight">
                      <p style={{fontSize: 18, fontWeight: "400", color: "#ffffffff"}}>${sub.price} <span>/mo</span></p>
                    </div>
                  </div>
                  <div className="subBottom">
                    <p>{sub.desc}</p>
                    <div onClick={() => handleSubscribe(sub.priceId)} style={styles.button}>
                      PURCHUSE PREMIUM SUBSCRIPTION
                    </div>
                  </div>

                </div>
              )
              
            })}
      </div>)}
      {isSubscribed && (
        <div style={{display: "flex", flexDirection: "row", gap: 10, flexWrap: "wrap"}}>
          <button style={styles.button}  onClick={() => manageBilling()}>Manage Billing</button>
        </div>
      )}

      


    </div>
  )
}

const styles = {
  button: {
    width: "100%",
    marginBottom: 10,
    outline: "none",
    border: "none",
    backgroundColor: "#546FDB",
    borderRadius: 10,
    color: "white",
    fontSize: 12,
    cursor: "pointer",
    padding: "7px 0px",
    textAlign: "center",
  }
};