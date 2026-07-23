# Guía de Implementación VPS — Meeting Scheduler Pro

> Versión self-hosted con SQLite (rama `vps-selfhosted`).  
> Sin Supabase. Sin base de datos externa. Un solo servidor.

---

## Requisitos mínimos del VPS

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 512 MB | 1 GB |
| Disco | 5 GB | 20 GB |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| Node.js | 20 LTS | 22 LTS |

---

## 1. Preparar el servidor

```bash
# Actualizar paquetes
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar
node --version   # v22.x.x
npm --version    # 10.x.x

# Instalar PM2 (gestor de procesos)
sudo npm install -g pm2

# Instalar Nginx
sudo apt install -y nginx

# Instalar git
sudo apt install -y git
```

---

## 2. Clonar el repositorio

```bash
# En el servidor, crear directorio de aplicación
sudo mkdir -p /opt/msp
sudo chown $USER:$USER /opt/msp
cd /opt/msp

# Clonar el mirror privado (la rama por defecto `main` ES la versión VPS)
git clone https://github.com/oreyes100/meeting-scheduler-pro-vps.git .
```

> El repo es privado: con HTTPS te pedirá usuario + Personal Access Token (crear en GitHub → Settings → Developer settings → Tokens, scope `repo`). Si prefieres SSH, configura una deploy key primero.

---

## 3. Variables de entorno

```bash
# Copiar plantilla
cp deploy/vps/.env.example .env.local

# Editar con tus valores reales
nano .env.local
```

Contenido mínimo de `.env.local`:

```env
# Secreto JWT — cámbialo, mínimo 32 caracteres
AUTH_SECRET=cambia-esto-por-una-clave-segura-de-32-chars-o-mas

# Ruta de la base de datos SQLite (se crea automáticamente)
DB_PATH=/opt/msp/data/msp.db

# Entorno de producción
NODE_ENV=production
```

Generar un `AUTH_SECRET` seguro:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 4. Instalar dependencias y compilar

Si el VPS tiene menos de 2 GB de RAM, crear swap ANTES de compilar (el build de Next.js puede superar 1 GB):

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

```bash
cd /opt/msp

# Instalar dependencias
npm ci --production=false

# Compilar (Next.js standalone)
npm run build
```

La compilación genera `.next/standalone/` — el servidor de producción completo.

Verificar que el tracing incluyó los archivos críticos:

```bash
# El schema SQL debe estar (la app lo lee con fs.readFileSync al arrancar)
ls .next/standalone/src/lib/schema.sql || cp -r --parents src/lib/schema.sql .next/standalone/

# El binario nativo de better-sqlite3 debe estar
ls .next/standalone/node_modules/better-sqlite3/build/Release/better_sqlite3.node \
  || cp -r node_modules/better-sqlite3 .next/standalone/node_modules/
```

---

## 5. Crear directorio de datos

```bash
mkdir -p /opt/msp/data
```

La base de datos SQLite (`msp.db`) se crea automáticamente al primer arranque con el esquema completo.

---

## 6. Importar datos desde Supabase (migración inicial)

Si migras desde una instalación existente con Supabase:

```bash
**Opción A (recomendada):** si ya tienes `data/msp.db` poblada en tu máquina local, transfiérela directamente:

```bash
# En tu máquina local — consolidar WAL antes de copiar (obligatorio con la app parada)
sqlite3 data/msp.db "PRAGMA wal_checkpoint(TRUNCATE);"

# Transferir al servidor
scp data/msp.db usuario@tu-vps:/opt/msp/data/msp.db
```

**Opción B:** exportar de Supabase e importar en el servidor:

```bash
# Exportar datos (ejecutar en tu máquina local con las credenciales de Supabase)
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
node scripts/export-supabase-to-sqlite.cjs

# Copiar exports al servidor
scp -r data/export/ usuario@tu-vps:/opt/msp/data/

# En el servidor: importar a SQLite
cd /opt/msp
node scripts/import-to-sqlite.cjs
```

Si **no** tienes datos previos, crea el primer administrador:

```bash
node scripts/create-admin.cjs \
  --email admin@tudominio.com \
  --password "TuPassword2024!" \
  --name "Nombre Apellido" \
  --congregation "Nombre Congregación"
```

---

## 7. Configurar PM2

```bash
# Crear configuración PM2
# IMPORTANTE: PM2 NO soporta env_file — las variables van directamente en el
# bloque env. Edita AUTH_SECRET con tu valor real antes de arrancar.
cat > /opt/msp/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'meeting-scheduler-pro',
    cwd: '/opt/msp/.next/standalone',
    script: 'server.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOSTNAME: '127.0.0.1',
      AUTH_SECRET: 'PEGA-AQUI-TU-SECRETO-DE-32-CHARS-O-MAS',
      DB_PATH: '/opt/msp/data/msp.db',
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
  }],
};
EOF

# Editar y pegar el AUTH_SECRET real (mismo generado en el paso 3)
nano /opt/msp/ecosystem.config.js

# Proteger el archivo (contiene el secreto)
chmod 600 /opt/msp/ecosystem.config.js

# Copiar archivos estáticos al standalone
cp -r /opt/msp/.next/static /opt/msp/.next/standalone/.next/static
cp -r /opt/msp/public /opt/msp/.next/standalone/public

# Iniciar con PM2
pm2 start /opt/msp/ecosystem.config.js

# Verificar que arrancó
pm2 status
pm2 logs meeting-scheduler-pro --lines 30

# Guardar configuración PM2 para reinicio automático
pm2 save
pm2 startup   # ejecutar el comando que te muestre
```

---

## 8. Configurar Nginx como proxy inverso

```bash
# Crear configuración del sitio
sudo nano /etc/nginx/sites-available/msp
```

Pegar:

```nginx
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;

    # Redirigir a HTTPS (descomentar después de instalar SSL)
    # return 301 https://$host$request_uri;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Activar sitio
sudo ln -s /etc/nginx/sites-available/msp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Firewall: permitir SSH y web, bloquear el resto (el puerto 3000 queda interno)
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

---

## 9. Instalar SSL con Certbot (HTTPS)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tudominio.com -d www.tudominio.com

# Renovación automática (ya la configura certbot, verificar)
sudo certbot renew --dry-run
```

Tras instalar SSL, descomentar el `return 301` en la config de Nginx y recargar:

```bash
sudo systemctl reload nginx
```

---

## 10. Verificar instalación

```bash
# Estado de la aplicación
pm2 status

# Logs en tiempo real
pm2 logs meeting-scheduler-pro

# Probar la API de salud
curl http://localhost:3000/api/health

# Probar login
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin@tudominio.com","password":"TuPassword2024!"}'
```

> ⚠️ **La cookie de sesión es `secure` en producción**: el navegador NO la aceptará
> sobre `http://IP:3000`. Si intentas hacer login en el navegador antes de tener
> HTTPS, quedarás en un bucle de login sin error visible. Verifica con `curl` en
> localhost (como arriba) o espera a completar el paso 9 (SSL) para probar en navegador.

---

## 11. Backups de la base de datos

```bash
# Script de backup diario — agregar al cron
cat > /opt/msp/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=/opt/msp/backups
mkdir -p $BACKUP_DIR
# SQLite hot backup (seguro incluso con la DB en uso)
sqlite3 /opt/msp/data/msp.db ".backup $BACKUP_DIR/msp-$(date +%Y%m%d-%H%M%S).db"
# Mantener solo los últimos 30 backups
ls -t $BACKUP_DIR/msp-*.db | tail -n +31 | xargs rm -f
echo "Backup completado: $(date)"
EOF

chmod +x /opt/msp/backup.sh

# Agregar cron para backup diario a las 3 AM
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/msp/backup.sh >> /opt/msp/backups/backup.log 2>&1") | crontab -
```

---

## 12. Actualizar la aplicación

```bash
cd /opt/msp

# Obtener cambios (en el VPS, origin apunta al mirror y la rama es main)
git pull origin main

# Reinstalar dependencias (si cambiaron)
npm ci --production=false

# Recompilar
npm run build

# Actualizar archivos estáticos
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

# Reiniciar sin downtime
pm2 restart meeting-scheduler-pro

# Verificar
pm2 status
pm2 logs meeting-scheduler-pro --lines 20
```

---

## Passwords de usuarios

Los passwords **no se exportan** de Supabase por seguridad. Después de la migración, los usuarios deben recibir una nueva contraseña. Como administrador:

1. Ir a **Permisos** → seleccionar usuario → "Establecer contraseña"
2. O usar el endpoint: `PUT /api/permissions/set-password` con `{ user_id, password }`

---

## Variables de entorno completas

```env
# OBLIGATORIO
AUTH_SECRET=clave-secreta-minimo-32-caracteres-aqui

# OPCIONAL (defaults razonables)
DB_PATH=/opt/msp/data/msp.db
NODE_ENV=production
PORT=3000
HOSTNAME=127.0.0.1
```

---

## Troubleshooting

**La app no inicia:**
```bash
pm2 logs meeting-scheduler-pro --lines 50
# Revisar que .env.local esté en /opt/msp/ y tenga AUTH_SECRET
```

**Error "database is locked":**
- SQLite WAL mode está activado, pero solo soporta un proceso. Verificar que `pm2` no esté corriendo múltiples instancias (`instances: 1`).

**Leaflet no carga el mapa:**
- El mapa de territorios carga Leaflet desde `unpkg.com`. El VPS necesita acceso a internet para tiles de OpenStreetMap.

**Login falla con usuarios migrados:**
- Los passwords no se migraron de Supabase. Usar `scripts/create-admin.cjs` o `PUT /api/permissions/set-password`.

**Puertos en uso:**
```bash
sudo lsof -i :3000
sudo lsof -i :80
```
