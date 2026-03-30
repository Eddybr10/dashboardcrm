# Guía de Despliegue: Proxy de Salida (IP Fija)

Esta guía explica cómo configurar el proxy para que tu aplicación en Render tenga una IP fija de salida.

## 1. Preparar el VPS (IP Fija)

Contrata un VPS (DigitalOcean, AWS, etc.) con una **IP Estática**.

### Opción A: Con Docker (Recomendado)

1.  Copia `scripts/outbound-proxy.js` y `Dockerfile.proxy` al VPS.
2.  Construye la imagen:
    ```bash
    docker build -t cloe-proxy -f Dockerfile.proxy .
    ```
3.  Ejecuta el contenedor para Azure SQL (puerto 1433):
    ```bash
    docker run -d --name proxy-azure \
      -e TARGET_HOST=tu-servidor-azure.database.windows.net \
      -e TARGET_PORT=1433 \
      -p 1433:1433 \
      --restart always \
      cloe-proxy
    ```
4.  (Opcional) Ejecuta otro para MySQL (puerto 3306):
    ```bash
    docker run -d --name proxy-mysql \
      -e TARGET_HOST=tu-servidor-mysql.com \
      -e TARGET_PORT=3306 \
      -p 3306:3306 \
      --restart always \
      cloe-proxy
    ```

### Opción B: Con Node.js directo

1.  Instala Node.js en el VPS.
2.  Ejecuta con `pm2` para que sea persistente:
    ```bash
    export TARGET_HOST=tu-servidor-azure.database.windows.net
    pm2 start scripts/outbound-proxy.js --name "cloe-proxy-azure"
    ```

## 2. Configurar Render

En el dashboard de Render, añade las siguientes variables de entorno a tu servicio:

### Para Azure SQL:
- `AZURE_SQL_PROXY_HOST`: La IP de tu VPS.
- (El resto de variables `AZURE_SQL_...` se mantienen igual).

### Para MySQL:
- `MYSQL_PROXY_HOST`: La IP de tu VPS.

## 3. Whitelist en el Sistema Externo

**ESTE ES EL PASO CRUCIAL:** 
Dile a tu administrador que añada solo la **IP de tu VPS** a la lista blanca. Ya no necesitas añadir los rangos de Render.

---
*Nota: El código de la aplicación detectará automáticamente estas variables y usará el proxy si están presentes.*
