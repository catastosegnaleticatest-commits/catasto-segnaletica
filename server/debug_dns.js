import dns from 'dns';

console.log('Resolving db.rhvxpqspgukssuklanql.supabase.co...');

dns.lookup('db.rhvxpqspgukssuklanql.supabase.co', { all: true }, (err, addresses) => {
    if (err) {
        console.error('❌ Lookup failed:', err);
    } else {
        console.log('✅ Addresses:', addresses);
    }
});

dns.resolve4('db.rhvxpqspgukssuklanql.supabase.co', (err, addresses) => {
    if (err) console.error('❌ IPv4 failed:', err.message);
    else console.log('✅ IPv4:', addresses);
});

dns.resolve6('db.rhvxpqspgukssuklanql.supabase.co', (err, addresses) => {
    if (err) console.error('❌ IPv6 failed:', err.message);
    else console.log('✅ IPv6:', addresses);
});
