}

function decryptPhoto(encryptedData, ivHex) {
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(Buffer.from(encryptedData, 'hex'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted;
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];

    if (!token && req.query.token) {
        token = req.query.token;
    }

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    } else {
        res.status(500).json({ error: 'Errore server' });
    }
    }
});

// === USERS ===
app.get('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Non autorizzato' });
    const result = await query('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
});

// === SIGNS ===
app.get('/api/signs', authenticateToken, async (req, res) => {
    try {
        const result = await query(`
            SELECT s.*, u.username as creator_username 
            FROM signs s 
            LEFT JOIN users u ON s.created_by = u.id 
            ORDER BY s.created_at DESC
        `);
        res.json(result.rows);
        app.get('/api/signs/:id/photo', authenticateToken, async (req, res) => {
            try {
                const result = await query('SELECT photo_path FROM signs WHERE id = $1', [req.params.id]);
                const sign = result.rows[0];

                if (!sign || !sign.photo_path || !fs.existsSync(sign.photo_path)) {
                    return res.status(404).json({ error: 'Foto non trovata' });
                }

                const encrypted = JSON.parse(fs.readFileSync(sign.photo_path, 'utf8'));
                const decrypted = decryptPhoto(encrypted.data, encrypted.iv);

                res.set('Content-Type', 'image/jpeg');
                res.send(decrypted);
            } catch (error) {
                console.error('Error reading photo:', error);
                res.status(500).json({ error: 'Errore lettura foto' });
            }

            function decryptPhoto(encryptedData, ivHex) {
                const iv = Buffer.from(ivHex, 'hex');
                const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
                let decrypted = decipher.update(Buffer.from(encryptedData, 'hex'));
                decrypted = Buffer.concat([decrypted, decipher.final()]);
                return decrypted;
            }

            function authenticateToken(req, res, next) {
                const authHeader = req.headers['authorization'];
                let token = authHeader && authHeader.split(' ')[1];

                if (!token && req.query.token) {
                    token = req.query.token;
                }

                if (!token) return res.sendStatus(401);

                jwt.verify(token, JWT_SECRET, (err, user) => {
                    if (err) return res.sendStatus(403);
                    req.user = user;
                    next();
                }); // Corrected closing parenthesis for jwt.verify
            } // Corrected closing parenthesis for authenticateToken

            // === USERS ===
            app.get('/api/users', authenticateToken, async (req, res) => {
                if (req.user.role !== 'admin') return res.status(403).json({ error: 'Non autorizzato' });
                const result = await query('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC');
                res.json(result.rows);
            });

            // === SIGNS ===
            app.get('/api/signs', authenticateToken, async (req, res) => {
                try {
                    const result = await query(`
            SELECT s.*, u.username as creator_username 
            FROM signs s 
            LEFT JOIN users u ON s.created_by = u.id 
            ORDER BY s.created_at DESC
        `);
                    res.json(result.rows);
                } catch (error) {
                    console.error('Error fetching signs:', error);
                    res.status(500).json({ error: 'Errore nel recupero dei segni' });
                }
            });

            app.get('/api/signs/:id/photo', authenticateToken, async (req, res) => {
                try {
                    const result = await query('SELECT photo_path FROM signs WHERE id = $1', [req.params.id]);
                    const sign = result.rows[0];

                    if (!sign || !sign.photo_path || !fs.existsSync(sign.photo_path)) {
                        return res.status(404).json({ error: 'Foto non trovata' });
                    }

                    const encrypted = JSON.parse(fs.readFileSync(sign.photo_path, 'utf8'));
                    const decrypted = decryptPhoto(encrypted.data, encrypted.iv);

                    res.set('Content-Type', 'image/jpeg');
                    res.send(decrypted);
                } catch (error) {
                    console.error('Error reading photo:', error);
                    res.status(500).json({ error: 'Errore lettura foto' });
                }
            });

            // === STATUS ===
            app.get('/api/status', authenticateToken, async (req, res) => {
                try {
                    const signsCount = await query('SELECT COUNT(*) as count FROM signs');
                    const intCount = await query('SELECT COUNT(*) as count FROM interventions');

                    res.json({
                        online: true,
                        uptime: process.uptime(),
                        totalSigns: parseInt(signsCount.rows[0].count),
                        totalInterventions: parseInt(intCount.rows[0].count),
                        serverTime: new Date().toISOString()
                    });
                } catch (error) {
                    res.json({ online: true, error: error.message, totalSigns: 0 });
                }
            });

            // WebSocket per sincronizzazione real-time
            io.on('connection', (socket) => {
                console.log('📱 Client connesso:', socket.id);

                socket.on('sync:request', async (data) => {
                    console.log('🔄 Richiesta sincronizzazione da:', socket.id);
                    try {
                        // Invia tutti i dati al client
                        const result = await query('SELECT * FROM signs'); // Changed db.query to query
                        socket.emit('sync:data', { signs: result.rows });
                    } catch (error) {
                        console.error('Errore sync socket:', error);
                    }
                });

                socket.on('disconnect', () => {
                    console.log('📴 Client disconnesso:', socket.id);
                });
            });

            // SERVI FILE STATICI DEL FRONTEND (Per Render)
            // Serve i file dalla cartella 'dist' (che deve essere nella root del progetto o ../dist)
            const distPath = path.join(__dirname, '../dist');
            if (fs.existsSync(distPath)) {
                console.log(`📂 Servendo frontend da: ${distPath}`);
                app.use(express.static(distPath));
                // Qualsiasi altra richiesta ritorna index.html (per SPA routing)
                app.get('*', (req, res) => {
                    res.sendFile(path.join(distPath, 'index.html'));
                });
            } else {
                console.log('⚠️ Cartella dist non trovata. Frontend non servito dal backend.');
            }

            // Avvia server
            httpServer.listen(PORT, '0.0.0.0', () => {
                console.log(`\n🚀 Server Catasto Segnaletica avviato!`);
                console.log(`📡 HTTP Server: http://localhost:${PORT}`);
                console.log(`🔐 Database: PostgreSQL (Supabase)`);
                console.log(`📁 Foto crittografate: ${photosDir}\n`);
            });
