import dotenv from 'dotenv'
import { transporter } from './mail'

dotenv.config()

async function test() {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: 'dorepallihemanth@gmail.com',
      subject: 'Test Mail',
      text: 'SMTP Working'
    })

    console.log('SUCCESS')
    console.log(info)
  } catch (err) {
    console.error('MAIL ERROR')
    console.error(err)
  }
}

test()