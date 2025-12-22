import React from 'react'

export default function Feature({style, header="Track Workouts", body="this is the text under", img="/images/icons/dumbbell.svg", imgScale=1, ...props}) {
  return (
    <div className='feature' >
        <div className='bullet'></div>
        <div className='top'>
            <h1>{header}</h1>
            <img src={img} alt={header} style={{transform: "scale(" + imgScale + ")"}} />
        </div>
        <div className='bottom'>
            <p>{body}</p>
        </div>
    </div>
  )
}
