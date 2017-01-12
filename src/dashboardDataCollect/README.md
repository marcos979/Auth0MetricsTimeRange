## Descripción
Consulta la API de Auth0 para obtener los usuarios y los guarda en la base de datos mongodb.
Esta app corre de forma programada, por default corre una vez por hora (* 0 * * * *).

Parámetros de configuración:
- mongodb_connection_string
- auth0_token (token para utilizar la API de Aut0)
- auth0_domain (token para utilizar la API de Aut0)
- cron_frequency 
