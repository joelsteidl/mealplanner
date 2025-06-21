import { client } from '../src/sanity/lib/client'

async function createInitialUsers() {
  try {
    // Create first user
    const user1 = await client.create({
      _type: 'user',
      name: 'Joel',
      email: process.env.ALLOWED_EMAIL_1,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1'
    })
    console.log('Created user 1:', user1)

    // Create second user
    const user2 = await client.create({
      _type: 'user',
      name: 'Spouse',
      email: process.env.ALLOWED_EMAIL_2,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user2'
    })
    console.log('Created user 2:', user2)

  } catch (error) {
    console.error('Error creating users:', error)
  }
}

createInitialUsers()
