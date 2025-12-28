var nodemailer = require('nodemailer');

async function sendEmail(to, subject, message) {
    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
                user: 'noreplydevapp@gmail.com',
                pass: process.env.EMAIL,
            }
    });

    const mailOptions = {
        from: 'Pumped Up <pumpedup@digitalcaldwell.com>', // sender address
        to, // list of receivers
        subject, // Subject line
        html: 
        `
                ${message}

        `,// plain text body
        // attachments: [
        //     {
        //       filename: "logo.png",
        //       path: './client/build/images/logo.png',
        //       cid: 'logo',
        //     },
        //   ],
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch(err) {
        console.error(err);
    }
    

    return;
}

// WELCOME EMAIL TEMPLATE
async function sendWelcomeEmail(to, username, verifyLink) {
    await sendEmail(to, 'Welcome to Pumped Up', 
    `
            Hi ${username}!
            <br />
            <br />
            Welcome to Pumped Up Workouts / Nutrition! We're delighted you've chosen our app to acheive your fitness goals.
            <br />
            <br />
            To get started, please take a moment to verify your email address by clicking on the following link:
            <br />
            <br />
            <a href="${verifyLink}" style="cursor: pointer; pointer-events: none; margin: 20px 20px; padding: 10px 30px; border-radius: 6px; background-color: #0582CA; text-decoration: none; color: white; ">Verify Email</a>
            <br />
            <br />
            The Pumped Up Team
    `);
    //console.log("Email sent.");
}


// CONFIRM EMAIL TEMPLATE
async function sendVerifyEmail(to, username, verifyLink) {
    await sendEmail(to, 'Verify email', 
    `
            Hi ${username}!
            <br />
            <br />
            We hope this message finds you well. It appears that you've requested to verify your email address for your Pumped Up account, and we want to ensure the security of your account information.
            <br />
            <br />
            Please take a moment to verify your new email address by clicking on the following link:
            <br />
            <br />
            <a href="${verifyLink}" style="cursor: pointer; pointer-events: none; margin: 20px 20px; padding: 10px 30px; border-radius: 6px; background-color: #0582CA; text-decoration: none; color: white; ">Verify Email</a>
            <br />
            <br />
            This step is crucial in confirming that the updated email is accurate and belongs to you. Your diligence in this matter ensures the continued security and accessibility of your Pumped Up account.
            <br />
            If you have any questions or concerns, please don't hesitate to contact our support team.
            <br />
            <br />
            Best regards,
            <br />
            The Pumped Up Team
    `);
    console.log("Email sent.");
}

// Forgot password
async function sendForgotPassword(to, username, code) {
    await sendEmail(to, 'Forgot Password - ' + username, 
    `
            Hi ${username}!
            <br />
            <br />
            We are sending you this email as part of our two-factor authentication process to ensure your account remains secure. As part of this process, we require you to enter a verification code.
            <br />
            <br />
            Your 6-digit verification code is: ${code}
            <br />
            <br />
            This code expires in 10 minutes.
            <br />
            <br />
            Please enter this code in the designated field to regain access to your account. If you have any questions or concerns, please don't hesitate to reach out to us.
            <br />
            <br />
            The Pumped Up Team
    `);
    //console.log("Email sent.");
}

module.exports = {
    sendWelcomeEmail,
    sendForgotPassword,
    sendVerifyEmail,
}