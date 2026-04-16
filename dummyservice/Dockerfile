# Verwenden Sie das Node.js-Basisimage
FROM node:14

# Erstellen Sie das Verzeichnis für die Anwendung im Container
WORKDIR /usr/src/app

# Kopieren Sie die Abhängigkeitsdateien in das Container-Verzeichnis
COPY package*.json ./

# Installieren Sie die Abhängigkeiten
RUN npm install

# Kopieren Sie die Anwendungsdateien in das Container-Verzeichnis
COPY . .

# Kompilieren Sie die TypeScript-Dateien
RUN npm run build

# Der Port, auf dem die Anwendung innerhalb des Containers läuft
EXPOSE 3000

# Starten Sie die Anwendung, wenn der Container ausgeführt wird
CMD ["node", "dist/index.js"]
