FROM node:20-alpine

# Strumenti per compilare moduli nativi (better-sqlite3, bcrypt)
RUN apk add --no-cache python3 make g++ linux-headers

WORKDIR /app

# Installa dipendenze senza eseguire postinstall (che lancia electron-rebuild)
COPY package*.json ./
RUN npm install --ignore-scripts

# Ricompila solo i moduli nativi necessari al server (per Node.js nativo, non Electron)
RUN npm rebuild better-sqlite3 bcrypt

# Copia il codice sorgente server
COPY server/ ./server/

# Copia il frontend compilato
COPY dist/ ./dist/

EXPOSE 3000

# Variabili che possono essere sovrascritte da fly.toml / Railway / Render
ENV PORT=3000
ENV CATASTO_DATA_DIR=/data
ENV CATASTO_DIST_DIR=/app/dist
ENV NODE_ENV=production

CMD ["node", "server/index.js"]
