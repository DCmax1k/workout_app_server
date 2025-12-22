import React from 'react'

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
            <a href='https://play.google.com/store/apps/details?id=com.caldwell.pumpedup' target='_blank' rel="noreferrer">Download</a>
            <a href='/login' className='download'>Account</a>
          </div>
        </div>
        
        <div className='index'>
          <h1>Get Pumped!</h1>
          <p className='quicksand'>Track your progress in and out of the gym,</p>
          <p className='quicksand'>using science to achieve your goals!</p>

          <a className='viewProject' href='https://github.com/DCmax1k/workout_app' target='_blank' rel="noreferrer" >View Project</a>

          <div>
            <p className='comingSoon'>Coming soon</p>
          </div>
          
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
          
    </div>
  )
}
export default Index
