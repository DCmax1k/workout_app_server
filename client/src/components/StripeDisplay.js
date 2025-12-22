import sendData from "../util/sendData";

export default function StripeDisplay({info, ...props}) {

  const subs = [
    {
      name: "Premium Yearly",
      price: '3.78',
      //priceId: 'price_1Sh3NPGf9fWISIA5NP009I8j', // test
      priceId: 'price_1ShGIrGf9fWISIA5lffICEvO',
      percentOff: "45",
      tag: "BEST VALUE",
    },
    {
      name: "Premium 6 Months",
      price: '4.81',
      //priceId: 'price_1Sh3ytGf9fWISIA5OAABwzkz', // test
      priceId: 'price_1ShGIlGf9fWISIA5ghAAZo7m',
      percentOff: "39",
      tag: "MOST POPULAR",
    },
    {
      name: "Premium Monthly",
      price: '6.89',
      //priceId: 'price_1Sh42AGf9fWISIA5X6PycqPg', //test
      priceId: 'price_1ShGIZGf9fWISIA5Sp6Pf4XA',
      percentOff: "",
      tag: "",
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
    <div {...props}>

      {!isSubscribed && (<div>
        {subs.map(sub => {
              return (
                <button onClick={() => handleSubscribe(sub.priceId)}>${sub.price} /mo</button>
              )
              
            })}
      </div>)}
      {isSubscribed && (
        <div>
          <button onClick={() => manageBilling()}>Manage Billing</button>
        </div>
      )}

      


    </div>
  )
}