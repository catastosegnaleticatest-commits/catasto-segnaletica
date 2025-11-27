import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Client } = pg;

// Recupera la password dalla variabile d'ambiente o usa quella hardcodata se necessario per il test
// (Assumiamo che la password in .env sia corretta)
const connectionString = process.env.DATABASE_URL;
const password = connectionString.split(':')[2].split('@')[0];
const projectRef = 'rhvxpqspgukssuklanql';

const configs = [
    {
        name: 'Direct (Standard)',
        host: 'db.rhvxpqspgukssuklanql.supabase.co',
        user: 'postgres',
        port: 5432
    },
    {
        name: 'Pooler (Ireland - eu-west-1)',
        host: 'aws-0-eu-west-1.pooler.supabase.com',
        user: `postgres.${projectRef}`,
        port: 5432 // Session mode via pooler
    },
    {
        name: 'Pooler (Frankfurt - eu-central-1)',
        host: 'aws-0-eu-central-1.pooler.supabase.com',
        user: `postgres.${projectRef}`,
        port: 5432
    },
    {
        name: 'Pooler (London - eu-west-2)',
        host: 'aws-0-eu-west-2.pooler.supabase.com',
        user: `postgres.${projectRef}`,
        port: 5432
    },
    {
        name: 'Pooler (Paris - eu-west-3)',
        host: 'aws-0-eu-west-3.pooler.supabase.com',
        user: `postgres.${projectRef}`,
        port: 5432
    },
    {
        name: 'Pooler (Milan - eu-south-1)',
        host: 'aws-0-eu-south-1.pooler.supabase.com',
        user: `postgres.${projectRef}`,
        port: 5432
    },
    {
        name: 'Pooler (US East - us-east-1)',
        host: 'aws-0-us-east-1.pooler.supabase.com',
        user: `postgres.${projectRef}`,
        port: 5432
    },
    {
        name: 'Pooler (Transaction Port 6543 - Ireland)',
        host: 'aws-0-eu-west-1.pooler.supabase.com',
        user: `postgres.${projectRef}`,
        port: 6543
    },
    {
        name: 'Pooler (Transaction Port 6543 - Frankfurt)',
        host: 'aws-0-eu-central-1.pooler.supabase.com',
        user: `postgres.${projectRef}`,
        port: 6543
    }
];

async function testConnection(config) {
    console.log(`\n🔌 Testing: ${config.name}`);
    console.log(`   Host: ${config.host}`);
    console.log(`   User: ${config.user}`);
    console.log(`   Port: ${config.port}`);

    const client = new Client({
        host: config.host,
        port: config.port,
        user: config.user,
        password: password,
        database: 'postgres',
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000
    });

    try {
        await client.connect();
        console.log('   ✅ SUCCESS! Connected.');
        await client.end();
        return config;
    } catch (error) {
        console.log(`   ❌ FAILED: ${error.message}`);
        return null;
    }
}

async function run() {
    console.log('🔍 Starting Connection Probe...');

    for (const config of configs) {
        const success = await testConnection(config);
        if (success) {
            console.log('\n🎉 FOUND WORKING CONFIGURATION!');
            console.log(`Use this Host: ${success.host}`);
            console.log(`Use this User: ${success.user}`);
            console.log(`Use this Port: ${success.port}`);

            // Genera la stringa completa
            const newUrl = `postgresql://${success.user}:${password}@${success.host}:${success.port}/postgres`;
            console.log(`\n📝 Connection String:\n${newUrl}`);
            process.exit(0);
        }
    }

    console.log('\n❌ All attempts failed.');
    process.exit(1);
}

run();
