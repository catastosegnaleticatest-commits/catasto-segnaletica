const API_URL = 'http://localhost:3000';

async function testApi() {
    try {
        // 1. Login
        console.log('Logging in...');
        const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin123' })
        });

        if (!loginResponse.ok) {
            throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
        }

        const loginData = await loginResponse.json();
        const token = loginData.token;
        console.log('Login successful, token received.');

        // 2. Get Users
        console.log('Fetching users...');
        const usersResponse = await fetch(`${API_URL}/api/users`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Users response status:', usersResponse.status);

        if (!usersResponse.ok) {
            const text = await usersResponse.text();
            throw new Error(`Get users failed: ${usersResponse.status} ${usersResponse.statusText} - ${text}`);
        }

        const users = await usersResponse.json();
        console.log('Users received:', JSON.stringify(users, null, 2));

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testApi();
