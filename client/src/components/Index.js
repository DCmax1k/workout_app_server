import React from 'react'
import Feature from './Feature'

const Index = () => {
  return (
    <div className='Index'>
        <div className='header'>
          <div className='title'>
            <h1>Pumped Up</h1>
            <p className='quicksand'>Workouts and Nutrition</p>
          </div>
          <div className='links'>
            <a href='#features'>Features</a>
            {/* <a href='https://play.google.com/store/apps/details?id=com.caldwell.pumpedup' target='_blank' rel="noreferrer">Download</a> */}
            <a href='/login' className='download'>Account</a>
          </div>
        </div>
        
        <div className='index'>
          <h1>Get Pumped!</h1>
          <p className='quicksand'>Track your progress in and out of the gym,</p>
          <p className='quicksand'>using science to achieve your goals!</p>

          <a className='viewProject' href='https://apps.apple.com/us/app/pumped-up-workouts-nutrition/id6757413833' target='_blank' rel="noreferrer" >Get on IOS</a>
          <br />
          <a className='viewProject' href='https://play.google.com/store/apps/details?id=com.caldwell.pumpedup' target='_blank' rel="noreferrer" >Get on Android</a>
          
        </div>

        <div className='phonesCont'>
            <div className='column'>
            <p>Crush your workouts</p>
            <img src='/images/phone/startWorkout.png' alt='App screenshot of start a workout' />
          </div>
          <div className='column'>
            <p>See your gains over time</p>
            <img src='/images/phone/progress.png' alt='App screenshot of start a workout' />
          </div>
          <div className='column'>
            <p>Nutritional insights and more</p>
            <img src='/images/phone/nutrition.png' alt='App screenshot of start a workout' />
          </div>
        </div>

        <div id='features'>
          <h1>Features</h1>

          <div className='features'>
            <Feature
              header='Track Workouts'
              body='Keep track of strength and cardio workouts and get hints for improvement.'
              img="/images/icons/dumbbell.svg"
              imgScale={1.5}
            />
            <Feature
              header='Calculate Nutrition'
              body='Log foods from meals throughout your day and get calculated science insights.'
              img="/images/icons/silverware.svg"
            />
            <Feature
              header='Monitor Metrics'
              body='Shown progression of workouts, nutritional macros, weight, sleep, and more.'
              img="/images/icons/progress.svg"
              imgScale={1.5}
            />
            <Feature
              header='AI Coaching'
              body='Improve on your workouts with AI feedback on your workouts.'
              img="/images/icons/aiSparkle.svg"
            />
            <Feature
              header='Goal Setting'
              body='Set goals to progress and visually see your improvement.'
              img="/images/icons/goal.svg"
            />
            <Feature
              header='Share with Friends'
              body='See when your friends hit the gym, beat their goals, or share a workout.'
              img="/images/icons/friends.svg"
              imgScale={1.5}
            />
          
          </div>
          

          

        </div>
          
    </div>
  )
}
export default Index
